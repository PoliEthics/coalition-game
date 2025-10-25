const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const os = require('os');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Serve static files from root directory
app.use(express.static(__dirname));

// Log all requests for debugging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Add favicon route to prevent 404
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Root route explicitly serves index.html
app.get('/', (req, res) => {
    console.log('Serving index.html for root');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Teacher route
app.get('/teacher', (req, res) => {
    console.log('Serving index.html for teacher');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Game state
let game = {
    started: false,
    currentRound: 1,
    currentPhase: 'setup', // setup, proposal, negotiation, voting, results
    factions: [],
    currentProposal: null,
    teacherSocket: null,
    students: {}, // socketId -> { factionId, name }
    metrics: {
        gdp: 100,
        inequality: 50,
        freedom: 70,
        socialCohesion: 60,
        environment: 50
    }
};

// Get local IP
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const localIP = getLocalIP();
console.log('\n🎮 COALITION POLITICS - SIMPLE MULTIPLAYER');
console.log('==========================================');
console.log(`📱 Students connect to: http://${localIP}:${PORT}`);
console.log(`👨‍🏫 Teacher connect to: http://localhost:${PORT}`);
console.log('==========================================\n');

io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);
    
    // Send current game state
    socket.emit('gameState', game);
    socket.emit('connectionInfo', { localIP });
    
    // Teacher registration
    socket.on('registerTeacher', () => {
        game.teacherSocket = socket.id;
        socket.emit('teacherRegistered', { localIP });
        console.log('👨‍🏫 Teacher registered');
    });
    
    // Student registration
    socket.on('registerStudent', (data) => {
        game.students[socket.id] = {
            factionId: data.factionId,
            name: data.name || 'Anonymous'
        };
        socket.emit('studentRegistered', { factionId: data.factionId });
        
        // Send updated student list to teacher
        io.to(game.teacherSocket).emit('studentsUpdate', Object.values(game.students));
        
        console.log(`👤 Student "${data.name}" joined ${data.factionId}`);
    });
    
    // Start game
    socket.on('startGame', (data) => {
        if (socket.id !== game.teacherSocket) return;
        
        game.factions = data.factions;
        game.started = true;
        game.currentPhase = 'proposal';
        game.currentRound = 1;
        
        console.log('\n🎮 GAME STARTED!');
        console.log(`Factions: ${game.factions.map(f => f.name).join(', ')}`);
        
        // Send full game state to everyone
        io.emit('gameStarted', game);
        
        // Send faction-specific data to each student
        Object.keys(game.students).forEach(socketId => {
            const student = game.students[socketId];
            const faction = game.factions.find(f => f.id === student.factionId);
            
            if (faction) {
                io.to(socketId).emit('yourFaction', {
                    faction: faction,
                    allFactions: game.factions.map(f => ({ id: f.id, name: f.name, icon: f.icon, color: f.color }))
                });
                console.log(`  📤 Sent faction data to ${student.name} (${faction.name})`);
            }
        });
    });
    
    // Proposal selected
    socket.on('selectProposal', (proposal) => {
        if (socket.id !== game.teacherSocket) return;
        
        game.currentProposal = proposal;
        game.currentPhase = 'negotiation';
        
        console.log(`\n📋 Proposal: ${proposal.policy.name}`);
        
        // Send to everyone
        io.emit('proposalSelected', { proposal, phase: 'negotiation' });
    });
    
    // Token transfer
    socket.on('sendToken', (data) => {
        const student = game.students[socket.id];
        if (!student) return;
        
        const fromFaction = game.factions.find(f => f.id === student.factionId);
        const toFaction = game.factions.find(f => f.id === data.toFactionId);
        
        if (fromFaction && toFaction && fromFaction.tokens.capital > 0) {
            fromFaction.tokens.capital--;
            toFaction.tokens.capital++;
            
            console.log(`💰 ${fromFaction.name} → ${toFaction.name} (1 token)`);
            
            // Broadcast updated factions
            io.emit('factionsUpdated', game.factions);
            
            // Update sender
            io.to(socket.id).emit('yourFaction', {
                faction: fromFaction,
                allFactions: game.factions.map(f => ({ id: f.id, name: f.name, icon: f.icon, color: f.color }))
            });
        }
    });
    
    // Start voting
    socket.on('startVoting', () => {
        if (socket.id !== game.teacherSocket) return;
        
        game.currentPhase = 'voting';
        
        // Reset votes
        game.factions.forEach(f => {
            f.hasVoted = false;
            f.vote = null;
        });
        
        console.log('\n🗳️  VOTING STARTED');
        io.emit('votingStarted', game.currentProposal);
    });
    
    // Submit vote
    socket.on('submitVote', (vote) => {
        const student = game.students[socket.id];
        if (!student) return;
        
        const faction = game.factions.find(f => f.id === student.factionId);
        if (faction && !faction.hasVoted) {
            faction.vote = vote;
            faction.hasVoted = true;
            
            console.log(`  ✓ ${faction.name} voted ${vote ? 'YES' : 'NO'}`);
            
            // Notify everyone
            io.emit('voteReceived', { factionId: faction.id, factionName: faction.name });
            
            // Check if all voted
            const allVoted = game.factions.every(f => f.hasVoted);
            if (allVoted) {
                io.emit('allVotesIn');
                console.log('  ✅ All votes received');
            }
        }
    });
    
    // Tally votes
    socket.on('tallyVotes', () => {
        if (socket.id !== game.teacherSocket) return;
        
        const yesVotes = game.factions.filter(f => f.vote === true).length;
        const noVotes = game.factions.filter(f => f.vote === false).length;
        const passed = yesVotes > noVotes;
        
        // Store policy info for objective checking
        const policyId = game.currentProposal?.policy?.id || null;
        const policyEffects = game.currentProposal?.policy?.effects || null;
        
        // Apply policy effects if passed
        if (passed && game.currentProposal && game.currentProposal.policy.effects) {
            Object.entries(game.currentProposal.policy.effects).forEach(([metric, change]) => {
                if (game.metrics[metric] !== undefined) {
                    game.metrics[metric] = Math.max(0, Math.min(200, game.metrics[metric] + change));
                }
            });
            console.log(`  📊 Metrics updated:`, game.metrics);
        }
        
        // Award tokens and voter approval
        game.factions.forEach(f => {
            if (f.vote === true && passed) {
                f.tokens.capital += 1;
                f.voterApproval = Math.min(100, (f.voterApproval || 50) + 3);
            } else if (f.vote === false && !passed) {
                f.tokens.capital += 1;
                f.voterApproval = Math.min(100, (f.voterApproval || 50) + 2);
            }
        });
        
        // If proposer, extra rewards
        if (game.currentProposal && game.currentProposal.proposer) {
            const proposer = game.factions.find(f => f.id === game.currentProposal.proposer.id);
            if (proposer && passed) {
                proposer.tokens.capital += 2;
                proposer.voterApproval = Math.min(100, (proposer.voterApproval || 50) + 5);
            }
        }
        
        // CHECK OBJECTIVES AFTER VOTE (SERVER-SIDE)
        if (policyId && policyEffects) {
            console.log(`\n🎯 Checking objectives for policy: ${policyId} (${passed ? 'PASSED' : 'REJECTED'})`);
            
            game.factions.forEach(faction => {
                if (!faction.objectives) return;
                
                faction.objectives.forEach(obj => {
                    if (obj.completed) return;
                    
                    // Policy count objectives (only for PASSED policies)
                    if (obj.type === 'policy_count' && passed && obj.target.metric) {
                        const effect = policyEffects[obj.target.metric];
                        if (effect) {
                            const matchesDirection = obj.target.direction === 'increase' ? effect > 0 : effect < 0;
                            if (matchesDirection) {
                                obj.progress = (obj.progress || 0) + 1;
                                console.log(`   ✅ ${faction.name}: ${obj.text} → Progress ${obj.progress}/${obj.target.count}`);
                                
                                if (obj.progress >= obj.target.count) {
                                    obj.completed = true;
                                    console.log(`   🎉 ${faction.name} COMPLETED: ${obj.text}`);
                                }
                            }
                        }
                    }
                    
                    // Multiple metrics (feminist) - only for PASSED policies
                    if (obj.type === 'policy_count' && passed && obj.target.metrics) {
                        const matchesAny = obj.target.metrics.some(m => {
                            const effect = policyEffects[m];
                            return (m === 'inequality' && effect < 0) || (m === 'freedom' && effect > 0);
                        });
                        if (matchesAny) {
                            obj.progress = (obj.progress || 0) + 1;
                            console.log(`   ✅ ${faction.name}: ${obj.text} → Progress ${obj.progress}/${obj.target.count}`);
                            
                            if (obj.progress >= obj.target.count) {
                                obj.completed = true;
                                console.log(`   🎉 ${faction.name} COMPLETED: ${obj.text}`);
                            }
                        }
                    }
                    
                    // Block policy objectives (vote NO and policy FAILS)
                    if (obj.type === 'block_policy' && !passed) {
                        if (obj.target.policies && obj.target.policies.includes(policyId)) {
                            obj.progress = (obj.progress || 0) + 1;
                            console.log(`   ✅ ${faction.name}: ${obj.text} → Progress ${obj.progress}/${obj.target.count}`);
                            
                            if (obj.progress >= obj.target.count) {
                                obj.completed = true;
                                console.log(`   🎉 ${faction.name} COMPLETED: ${obj.text}`);
                            }
                        }
                    }
                    
                    // Specific policy objectives (PASSED)
                    if (obj.type === 'specific_policy' && passed && obj.target.policy === policyId) {
                        obj.completed = true;
                        console.log(`   🎉 ${faction.name} COMPLETED: ${obj.text}`);
                    }
                    
                    // Maintain metric objectives (check every round)
                    if (obj.type === 'maintain_metric' && !obj.failed) {
                        const currentValue = game.metrics[obj.target.metric];
                        const targetValue = obj.target.value;
                        const passes = obj.target.operator === '>' ? 
                            currentValue > targetValue : 
                            currentValue < targetValue;
                        
                        if (!passes) {
                            obj.failed = true;
                            console.log(`   ❌ ${faction.name} FAILED: ${obj.text}`);
                        }
                    }
                });
                
                // Check if all main objectives complete for +40% bonus
                const mainObjectives = faction.objectives.filter(o => !o.text.includes('BONUS'));
                const allMainComplete = mainObjectives.every(o => 
                    o.completed || (o.type === 'maintain_metric' && !o.failed) || o.type === 'final_metric'
                );
                
                if (allMainComplete && !faction.objectivesBonus) {
                    faction.objectivesBonus = true;
                    faction.voterApproval = Math.min(100, (faction.voterApproval || 50) + 40);
                    console.log(`   🏆 ${faction.name} completed ALL MAIN OBJECTIVES! +40% approval (now ${faction.voterApproval}%)`);
                }
            });
        }
        
        console.log(`\n📊 RESULTS: ${passed ? 'PASSED' : 'REJECTED'} (${yesVotes} YES, ${noVotes} NO)`);
        
        const results = {
            passed,
            yesVotes,
            noVotes,
            factions: game.factions,
            metrics: game.metrics,
            policyId: policyId,
            policyEffects: policyEffects
        };
        
        io.emit('voteResults', results);
        
        // Update all students with new faction data and metrics
        Object.keys(game.students).forEach(socketId => {
            const student = game.students[socketId];
            const faction = game.factions.find(f => f.id === student.factionId);
            if (faction) {
                io.to(socketId).emit('yourFaction', {
                    faction: faction,
                    allFactions: game.factions.map(f => ({ id: f.id, name: f.name, icon: f.icon, color: f.color }))
                });
            }
        });
        
        // Broadcast updated game state
        io.emit('gameState', game);
    });
    
    // Next round
    socket.on('nextRound', () => {
        if (socket.id !== game.teacherSocket) {
            console.log('⚠️ nextRound called by non-teacher');
            return;
        }
        
        console.log(`\n🔄 NEXT ROUND - Starting Round ${game.currentRound + 1}`);
        
        game.currentRound++;
        game.currentPhase = 'proposal';
        game.currentProposal = null;
        
        // Reset votes
        game.factions.forEach(f => {
            f.hasVoted = false;
            f.vote = null;
        });
        
        console.log(`✅ Reset complete - Round ${game.currentRound}, Phase: ${game.currentPhase}`);
        console.log(`📊 Factions:`, game.factions.map(f => `${f.name} (${f.voterApproval}%)`));
        
        // Broadcast round change
        io.emit('roundChanged', { 
            round: game.currentRound, 
            phase: 'proposal' 
        });
        
        console.log('📡 Broadcast roundChanged event');
        
        // Send updated game state to everyone
        io.emit('gameState', game);
        
        console.log('📡 Broadcast gameState');
        
        // Update all students with fresh faction data
        Object.keys(game.students).forEach(socketId => {
            const student = game.students[socketId];
            const faction = game.factions.find(f => f.id === student.factionId);
            if (faction) {
                io.to(socketId).emit('yourFaction', {
                    faction: faction,
                    allFactions: game.factions.map(f => ({ id: f.id, name: f.name, icon: f.icon, color: f.color }))
                });
            }
        });
        
        console.log('✅ All updates sent - Ready for next round');
    });
    
    // End game
    socket.on('endGame', () => {
        if (socket.id !== game.teacherSocket) {
            console.log('⚠️ endGame called by non-teacher');
            return;
        }
        
        console.log('\n🏁 ENDING GAME...');
        console.log(`📊 Final Round: ${game.currentRound}`);
        
        // Check final objectives
        game.factions.forEach(faction => {
            if (!faction.objectives) return;
            
            console.log(`\n🎯 Checking final objectives for ${faction.name}:`);
            
            faction.objectives.forEach(obj => {
                // Final metric objectives
                if (obj.type === 'final_metric' && !obj.completed) {
                    const currentValue = game.metrics[obj.target.metric];
                    const targetValue = obj.target.value;
                    const passes = obj.target.operator === '>' ? 
                        currentValue > targetValue : 
                        currentValue < targetValue;
                    
                    if (passes) {
                        obj.completed = true;
                        console.log(`  ✅ Completed: ${obj.text} (${currentValue} vs ${targetValue})`);
                    } else {
                        console.log(`  ❌ Failed: ${obj.text} (${currentValue} vs ${targetValue})`);
                    }
                }
            });
            
            // Check if all main objectives complete for bonus
            const mainObjectives = faction.objectives.filter(o => !o.text.includes('BONUS'));
            const completedMain = mainObjectives.filter(o => o.completed).length;
            const failedMain = mainObjectives.filter(o => o.type === 'maintain_metric' && o.failed).length;
            
            console.log(`  📈 Main objectives: ${completedMain}/${mainObjectives.length} complete, ${failedMain} failed`);
            
            const allMainComplete = mainObjectives.every(o => 
                o.completed || (o.type === 'maintain_metric' && !o.failed)
            );
            
            if (allMainComplete && !faction.objectivesBonus) {
                faction.objectivesBonus = true;
                faction.voterApproval = Math.min(100, (faction.voterApproval || 50) + 40);
                console.log(`  🏆 ${faction.name} completed all objectives! +40% approval (now ${faction.voterApproval}%)`);
            }
        });
        
        // Sort factions by voter approval
        const rankedFactions = [...game.factions].sort((a, b) => (b.voterApproval || 0) - (a.voterApproval || 0));
        const winner = rankedFactions[0];
        
        console.log(`\n🏆 GAME OVER!`);
        console.log(`🥇 Winner: ${winner.name} (${winner.voterApproval}% approval)`);
        console.log(`📊 Final Rankings:`);
        rankedFactions.forEach((f, i) => {
            console.log(`  ${i + 1}. ${f.name}: ${f.voterApproval}%`);
        });
        
        console.log(`\n🏆 GAME OVER! Winner: ${winner.name} (${winner.voterApproval}% approval)`);
        
        io.emit('gameEnded', {
            winner: winner,
            factions: rankedFactions
        });
        
        // Reset game state for next game
        game.started = false;
        game.currentRound = 1;
        game.currentPhase = 'setup';
        game.factions = [];
        game.currentProposal = null;
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
        
        if (socket.id === game.teacherSocket) {
            console.log('👨‍🏫 Teacher disconnected');
            game.teacherSocket = null;
        }
        
        if (game.students[socket.id]) {
            console.log(`👤 Student "${game.students[socket.id].name}" disconnected`);
            delete game.students[socket.id];
            
            // Update teacher
            if (game.teacherSocket) {
                io.to(game.teacherSocket).emit('studentsUpdate', Object.values(game.students));
            }
        }
    });
});

http.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎮 Coalition Game Server`);
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.RENDER ? 'Render.com' : 'Local'}`);
    if (!process.env.RENDER) {
        console.log(`📱 Students: http://localhost:${PORT}`);
        console.log(`👨‍🏫 Teacher: http://localhost:${PORT}/teacher`);
    } else {
        console.log(`🚀 Deployed on Render - use your .onrender.com URL`);
    }
    console.log('');
});
