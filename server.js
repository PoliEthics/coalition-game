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
    students: {}, // socketId -> { factionId, name, isLeader }
    metrics: {
        gdp: 100,
        inequality: 50,
        freedom: 70,
        socialCohesion: 60,
        environment: 50
    }
};

// Helper function to create a faction
function createFaction(factionId) {
    const factionData = {
        socialist: {
            id: 'socialist',
            name: 'Socialist Party',
            icon: '🌹',
            color: '#e74c3c',
            description: 'Reduce inequality, increase social welfare'
        },
        liberal: {
            id: 'liberal',
            name: 'Liberal Democrats',
            icon: '🗽',
            color: '#3498db',
            description: 'Maximize freedom and environmental protection'
        },
        conservative: {
            id: 'conservative',
            name: 'Conservative Party',
            icon: '🦅',
            color: '#2c3e50',
            description: 'Promote economic growth and stability'
        },
        green: {
            id: 'green',
            name: 'Green Party',
            icon: '💚',
            color: '#27ae60',
            description: 'Prioritize environmental sustainability'
        },
        libertarian: {
            id: 'libertarian',
            name: 'Libertarian Party',
            icon: '🗽',
            color: '#f39c12',
            description: 'Minimize government, maximize individual freedom'
        },
        populist: {
            id: 'populist',
            name: 'Populist Movement',
            icon: '🗣️',
            color: '#9b59b6',
            description: 'Protect national identity and social cohesion'
        },
        technofeudalist: {
            id: 'technofeudalist',
            name: 'Technofeudalists',
            icon: '🏢',
            color: '#34495e',
            description: 'Unleash innovation, accept inequality as progress'
        },
        feminist: {
            id: 'feminist',
            name: 'Feminist Movement',
            icon: '♀️',
            color: '#e91e63',
            description: 'Achieve gender equality and social justice'
        }
    };
    
    const base = factionData[factionId] || factionData.socialist;
    
    return {
        ...base,
        tokens: { capital: 0 },
        voterApproval: 50,
        hasVoted: false,
        vote: null,
        objectives: generateObjectives(factionId)
    };
}

// Generate objectives function (needed by createFaction)
function generateObjectives(factionId) {
    const objectives = {
        socialist: [
            { 
                id: 'socialist_1',
                text: 'Pass 1 policy that reduces inequality',
                type: 'policy_count_voted',
                target: { metric: 'inequality', direction: 'decrease', count: 1 },
                completed: false,
                progress: 0
            },
            { 
                id: 'socialist_2',
                text: 'Increase social cohesion by 10+ points',
                type: 'metric_change',
                target: { metric: 'socialCohesion', change: 10 },
                completed: false,
                progress: 0,
                startValue: 50
            },
            { 
                id: 'socialist_3',
                text: 'Successfully block 1 policy that increases inequality',
                type: 'block_voted',
                target: { metric: 'inequality', direction: 'increase', count: 1 },
                completed: false,
                progress: 0
            }
        ],
        liberal: [
            { 
                id: 'liberal_1',
                text: 'Pass 1 environmental policy',
                type: 'policy_count_voted',
                target: { metric: 'environment', direction: 'increase', count: 1 },
                completed: false,
                progress: 0
            },
            { 
                id: 'liberal_2',
                text: 'Increase freedom by 10+ points',
                type: 'metric_change',
                target: { metric: 'freedom', change: 10 },
                completed: false,
                progress: 0,
                startValue: 70
            },
            { 
                id: 'liberal_3',
                text: 'Successfully block 1 policy that reduces freedom',
                type: 'block_voted',
                target: { metric: 'freedom', direction: 'decrease', count: 1 },
                completed: false,
                progress: 0
            }
        ],
        conservative: [
            { 
                id: 'conservative_1',
                text: 'Pass 1 policy that increases GDP',
                type: 'policy_count_voted',
                target: { metric: 'gdp', direction: 'increase', count: 1 },
                completed: false,
                progress: 0
            },
            { 
                id: 'conservative_2',
                text: 'Successfully block 1 tax increase',
                type: 'block_voted',
                target: { policies: ['tax_rich'], count: 1 },
                completed: false,
                progress: 0
            },
            { 
                id: 'conservative_3',
                text: 'Increase GDP by 10+ points',
                type: 'metric_change',
                target: { metric: 'gdp', change: 10 },
                completed: false,
                progress: 0,
                startValue: 100
            }
        ],
        green: [
            { 
                id: 'green_1',
                text: 'Pass 1 environmental policy',
                type: 'policy_count_voted',
                target: { metric: 'environment', direction: 'increase', count: 1 },
                completed: false,
                progress: 0
            },
            { 
                id: 'green_2',
                text: 'Increase environment by 15+ points',
                type: 'metric_change',
                target: { metric: 'environment', change: 15 },
                completed: false,
                progress: 0,
                startValue: 50
            },
            { 
                id: 'green_3',
                text: 'Successfully block 1 policy that harms environment',
                type: 'block_voted',
                target: { metric: 'environment', direction: 'decrease', count: 1 },
                completed: false,
                progress: 0
            }
        ],
        libertarian: [
            { 
                id: 'libertarian_1',
                text: 'Pass 1 policy that increases freedom',
                type: 'policy_count_voted',
                target: { metric: 'freedom', direction: 'increase', count: 1 },
                completed: false,
                progress: 0
            },
            { 
                id: 'libertarian_2',
                text: 'Successfully block 1 government expansion',
                type: 'block_voted',
                target: { policies: ['universal_healthcare', 'police_funding', 'education_funding'], count: 1 },
                completed: false,
                progress: 0
            },
            { 
                id: 'libertarian_3',
                text: 'Reduce inequality by 15+ points',
                type: 'metric_change',
                target: { metric: 'inequality', change: -15 },
                completed: false,
                progress: 0,
                startValue: 50
            }
        ],
        populist: [
            { 
                id: 'populist_1',
                text: 'Pass immigration restriction policy',
                type: 'specific_voted',
                target: { policy: 'immigration_restrict' },
                completed: false
            },
            { 
                id: 'populist_2',
                text: 'Increase social cohesion by 15+ points',
                type: 'metric_change',
                target: { metric: 'socialCohesion', change: 15 },
                completed: false,
                progress: 0,
                startValue: 50
            },
            { 
                id: 'populist_3',
                text: 'Successfully propose 2 policies',
                type: 'proposer_success',
                target: { count: 2 },
                completed: false,
                progress: 0
            }
        ],
        technofeudalist: [
            { 
                id: 'techno_1',
                text: 'Pass deregulation policy',
                type: 'specific_voted',
                target: { policy: 'deregulate' },
                completed: false
            },
            { 
                id: 'techno_2',
                text: 'Increase GDP by 15+ points',
                type: 'metric_change',
                target: { metric: 'gdp', change: 15 },
                completed: false,
                progress: 0,
                startValue: 100
            },
            { 
                id: 'techno_3',
                text: 'Successfully propose 2 policies',
                type: 'proposer_success',
                target: { count: 2 },
                completed: false,
                progress: 0
            }
        ],
        feminist: [
            { 
                id: 'feminist_1',
                text: 'Pass 1 policy that reduces inequality',
                type: 'policy_count_voted',
                target: { metric: 'inequality', direction: 'decrease', count: 1 },
                completed: false,
                progress: 0
            },
            { 
                id: 'feminist_2',
                text: 'Increase social cohesion by 10+ points',
                type: 'metric_change',
                target: { metric: 'socialCohesion', change: 10 },
                completed: false,
                progress: 0,
                startValue: 50
            },
            { 
                id: 'feminist_3',
                text: 'Pass 1 policy that increases freedom',
                type: 'policy_count_voted',
                target: { metric: 'freedom', direction: 'increase', count: 1 },
                completed: false,
                progress: 0
            }
        ]
    };
    return objectives[factionId] || [];
}

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
    
    // Student registration (just name, no faction yet)
    socket.on('registerStudent', (data) => {
        game.students[socket.id] = {
            factionId: null,
            name: data.name || 'Anonymous',
            isLeader: false
        };
        socket.emit('studentRegistered', { name: data.name });
        
        // Send available factions
        socket.emit('availableFactions', game.factions);
        
        // Send updated student list to teacher
        if (game.teacherSocket) {
            io.to(game.teacherSocket).emit('studentsUpdate', Object.values(game.students));
        }
        
        console.log(`👤 Student "${data.name}" connected (no faction yet)`);
    });
    
    // Student selects faction
    socket.on('selectFaction', (data) => {
        const student = game.students[socket.id];
        if (!student) return;
        
        const factionId = data.factionId;
        
        // Find or create faction
        let faction = game.factions.find(f => f.id === factionId);
        
        if (!faction) {
            // Create new faction (auto-add when first student joins)
            faction = createFaction(factionId);
            game.factions.push(faction);
            console.log(`  ➕ Auto-added faction: ${faction.name}`);
        }
        
        // Check if this is the first student in this faction
        const existingStudentsInFaction = Object.values(game.students).filter(s => s.factionId === factionId);
        const isFirstInFaction = existingStudentsInFaction.length === 0;
        
        // Assign student to faction
        student.factionId = factionId;
        student.isLeader = isFirstInFaction;
        
        console.log(`  ${student.isLeader ? '👑' : '👥'} ${student.name} joined ${faction.name} as ${student.isLeader ? 'LEADER' : 'ADVISOR'}`);
        
        // Send faction info to student
        io.to(socket.id).emit('factionSelected', {
            faction: faction,
            isLeader: student.isLeader,
            allFactions: game.factions.map(f => ({ 
                id: f.id, 
                name: f.name, 
                icon: f.icon, 
                color: f.color,
                studentCount: Object.values(game.students).filter(s => s.factionId === f.id).length
            }))
        });
        
        // Broadcast updated faction list to all students
        io.emit('factionsUpdated', game.factions.map(f => ({ 
            id: f.id, 
            name: f.name, 
            icon: f.icon, 
            color: f.color,
            studentCount: Object.values(game.students).filter(s => s.factionId === f.id).length
        })));
        
        // Update teacher
        if (game.teacherSocket) {
            io.to(game.teacherSocket).emit('studentsUpdate', Object.values(game.students));
            io.to(game.teacherSocket).emit('factionsUpdate', game.factions.map(f => ({
                ...f,
                studentCount: Object.values(game.students).filter(s => s.factionId === f.id).length
            })));
        }
    });
    
    // Start game
    socket.on('startGame', () => {
        if (socket.id !== game.teacherSocket) return;
        
        // Validate minimum requirements
        const studentCount = Object.keys(game.students).length;
        const factionCount = game.factions.length;
        
        if (studentCount < 2) {
            io.to(socket.id).emit('gameStartError', { message: 'Need at least 2 students to start' });
            console.log('❌ Cannot start: Need at least 2 students');
            return;
        }
        
        if (factionCount < 2) {
            io.to(socket.id).emit('gameStartError', { message: 'Need at least 2 different factions to start' });
            console.log('❌ Cannot start: Need at least 2 factions');
            return;
        }
        
        // Initialize factions with starting tokens
        game.factions.forEach(f => {
            if (!f.tokens) f.tokens = {};
            f.tokens.capital = 5; // Starting political capital
            if (!f.voterApproval) f.voterApproval = 50;
        });
        
        game.started = true;
        game.currentPhase = 'proposal';
        game.currentRound = 1;
        
        console.log('\n🎮 GAME STARTED!');
        console.log(`  👥 ${studentCount} students across ${factionCount} factions`);
        console.log(`  Factions: ${game.factions.map(f => f.name).join(', ')}`);
        
        // Send full game state to everyone
        io.emit('gameStarted', game);
        
        // Send faction-specific data to each student
        Object.keys(game.students).forEach(socketId => {
            const student = game.students[socketId];
            const faction = game.factions.find(f => f.id === student.factionId);
            
            if (faction) {
                io.to(socketId).emit('yourFaction', {
                    faction: faction,
                    isLeader: student.isLeader,
                    allFactions: game.factions.map(f => ({ id: f.id, name: f.name, icon: f.icon, color: f.color }))
                });
                console.log(`  📤 ${student.isLeader ? '👑' : '👥'} ${student.name} (${faction.name})`);
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
        
        // Only leaders can trade tokens
        if (!student.isLeader) {
            console.log(`  ❌ ${student.name} tried to trade token but is not leader`);
            io.to(socket.id).emit('actionRejected', { reason: 'Only faction leaders can trade tokens' });
            return;
        }
        
        const fromFaction = game.factions.find(f => f.id === student.factionId);
        const toFaction = game.factions.find(f => f.id === data.toFactionId);
        
        if (fromFaction && toFaction && fromFaction.tokens.capital > 0) {
            fromFaction.tokens.capital--;
            toFaction.tokens.capital++;
            
            console.log(`💰 ${fromFaction.name} → ${toFaction.name} (1 token)`);
            
            // Broadcast updated factions
            io.emit('factionsUpdated', game.factions);
            
            // Update sender with their leader status
            const senderStudent = game.students[socket.id];
            io.to(socket.id).emit('yourFaction', {
                faction: fromFaction,
                isLeader: senderStudent ? senderStudent.isLeader : false,
                allFactions: game.factions.map(f => ({ id: f.id, name: f.name, icon: f.icon, color: f.color }))
            });
        }
    });
    
    // Send message between factions
    socket.on('sendMessage', (data) => {
        const student = game.students[socket.id];
        if (!student) return;
        
        // Only leaders can send messages
        if (!student.isLeader) {
            console.log(`  ❌ ${student.name} tried to send message but is not leader`);
            io.to(socket.id).emit('actionRejected', { reason: 'Only faction leaders can send messages' });
            return;
        }
        
        const fromFaction = game.factions.find(f => f.id === student.factionId);
        const toFaction = game.factions.find(f => f.id === data.toFactionId);
        
        if (!fromFaction || !toFaction) return;
        
        console.log(`💬 Message: ${fromFaction.name} → ${toFaction.name}: "${data.message}"`);
        
        // Find all students in the target faction
        const targetStudents = Object.keys(game.students).filter(sid => {
            return game.students[sid].factionId === data.toFactionId;
        });
        
        // Send message to all students in target faction
        targetStudents.forEach(studentId => {
            io.to(studentId).emit('messageReceived', {
                from: {
                    factionId: fromFaction.id,
                    factionName: fromFaction.name,
                    factionIcon: fromFaction.icon,
                    factionColor: fromFaction.color
                },
                message: data.message,
                timestamp: Date.now()
            });
        });
        
        // Confirm to sender
        io.to(socket.id).emit('messageSent', {
            to: toFaction.name
        });
    });
    
    // Respond to message
    socket.on('respondToMessage', (data) => {
        const student = game.students[socket.id];
        if (!student) return;
        
        // Only leaders can respond
        if (!student.isLeader) {
            console.log(`  ❌ ${student.name} tried to respond but is not leader`);
            io.to(socket.id).emit('actionRejected', { reason: 'Only faction leaders can respond to messages' });
            return;
        }
        
        const fromFaction = game.factions.find(f => f.id === student.factionId);
        const toFaction = game.factions.find(f => f.id === data.toFactionId);
        
        if (!fromFaction || !toFaction) return;
        
        const responseText = data.response === 'agree' ? '✅ Agreed to your proposal' : '❌ Declined your proposal';
        console.log(`💬 Response: ${fromFaction.name} → ${toFaction.name}: ${responseText}`);
        
        // Find all students in the target faction
        const targetStudents = Object.keys(game.students).filter(sid => {
            return game.students[sid].factionId === data.toFactionId;
        });
        
        // Send response to all students in target faction
        targetStudents.forEach(studentId => {
            io.to(studentId).emit('messageReceived', {
                from: {
                    factionId: fromFaction.id,
                    factionName: fromFaction.name,
                    factionIcon: fromFaction.icon,
                    factionColor: fromFaction.color
                },
                message: responseText,
                timestamp: Date.now(),
                isResponse: true
            });
        });
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
    
    // Restart voting (teacher only)
    socket.on('restartVoting', () => {
        if (socket.id !== game.teacherSocket) return;
        
        // Reset votes
        game.factions.forEach(f => {
            f.hasVoted = false;
            f.vote = null;
        });
        
        console.log('\n🔄 VOTING RESTARTED by teacher');
        io.emit('votingRestarted');
        io.emit('votingStarted', game.currentProposal);
        io.emit('gameState', game);
    });
    
    // Submit vote
    socket.on('submitVote', (vote) => {
        const student = game.students[socket.id];
        if (!student) return;
        
        // Only leaders can vote
        if (!student.isLeader) {
            console.log(`  ❌ ${student.name} tried to vote but is not leader`);
            io.to(socket.id).emit('voteRejected', { reason: 'Only faction leaders can vote' });
            return;
        }
        
        const faction = game.factions.find(f => f.id === student.factionId);
        if (faction && !faction.hasVoted) {
            faction.vote = vote;
            faction.hasVoted = true;
            
            console.log(`  ✓ ${faction.name} voted ${vote ? 'YES' : 'NO'} (by leader ${student.name})`);
            
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
                f.voterApproval = Math.min(100, (f.voterApproval || 50) + 2); // Changed from +3 to +2
            } else if (f.vote === false && !passed) {
                f.tokens.capital += 1;
                f.voterApproval = Math.min(100, (f.voterApproval || 50) + 2); // Changed from +3 to +2
            }
        });
        
        // If proposer, extra rewards or penalties
        if (game.currentProposal && game.currentProposal.proposer) {
            const proposer = game.factions.find(f => f.id === game.currentProposal.proposer.id);
            if (proposer) {
                if (passed) {
                    proposer.tokens.capital += 2;
                    proposer.voterApproval = Math.min(100, (proposer.voterApproval || 50) + 3); // Changed from +5 to +3
                    console.log(`  ✅ Proposer ${proposer.name}: +2 tokens, +3% approval`);
                } else {
                    proposer.voterApproval = Math.max(0, (proposer.voterApproval || 50) - 5);
                    console.log(`  ❌ Proposer ${proposer.name}: -5% approval (proposal failed)`);
                }
            }
        }
        
        // CHECK OBJECTIVES AFTER VOTE (SERVER-SIDE)
        if (policyId && policyEffects) {
            console.log(`\n🎯 Checking objectives for policy: ${policyId} (${passed ? 'PASSED' : 'REJECTED'})`);
            
            game.factions.forEach(faction => {
                if (!faction.objectives) return;
                
                const factionVote = faction.vote; // true = YES, false = NO, null = abstain
                
                faction.objectives.forEach(obj => {
                    if (obj.completed) return;
                    
                    // policy_count_voted: Must vote YES and policy PASSES
                    if (obj.type === 'policy_count_voted' && factionVote === true && passed) {
                        const effect = policyEffects[obj.target.metric];
                        if (effect) {
                            const matchesDirection = obj.target.direction === 'increase' ? effect > 0 : effect < 0;
                            if (matchesDirection) {
                                obj.progress = (obj.progress || 0) + 1;
                                console.log(`   ✅ ${faction.name} voted YES & passed: ${obj.text} → ${obj.progress}/${obj.target.count}`);
                                
                                if (obj.progress >= obj.target.count) {
                                    obj.completed = true;
                                    console.log(`   🎉 ${faction.name} COMPLETED: ${obj.text}`);
                                }
                            }
                        }
                    }
                    
                    // block_voted: Must vote NO and policy FAILS
                    if (obj.type === 'block_voted' && factionVote === false && !passed) {
                        let matches = false;
                        
                        if (obj.target.policies && obj.target.policies.includes(policyId)) {
                            matches = true;
                        } else if (obj.target.metric && policyEffects[obj.target.metric]) {
                            const effect = policyEffects[obj.target.metric];
                            matches = obj.target.direction === 'increase' ? effect > 0 : effect < 0;
                        }
                        
                        if (matches) {
                            obj.progress = (obj.progress || 0) + 1;
                            console.log(`   ✅ ${faction.name} voted NO & blocked: ${obj.text} → ${obj.progress}/${obj.target.count}`);
                            
                            if (obj.progress >= obj.target.count) {
                                obj.completed = true;
                                console.log(`   🎉 ${faction.name} COMPLETED: ${obj.text}`);
                            }
                        }
                    }
                    
                    // specific_voted: Must vote YES and that specific policy PASSES
                    if (obj.type === 'specific_voted' && factionVote === true && passed && obj.target.policy === policyId) {
                        obj.completed = true;
                        console.log(`   🎉 ${faction.name} COMPLETED: ${obj.text}`);
                    }
                    
                    // proposer_success: Must be proposer and policy PASSES
                    if (obj.type === 'proposer_success' && passed) {
                        if (game.currentProposal && game.currentProposal.proposer && game.currentProposal.proposer.id === faction.id) {
                            obj.progress = (obj.progress || 0) + 1;
                            console.log(`   ✅ ${faction.name} proposal passed: ${obj.text} → ${obj.progress}/${obj.target.count}`);
                            
                            if (obj.progress >= obj.target.count) {
                                obj.completed = true;
                                console.log(`   🎉 ${faction.name} COMPLETED: ${obj.text}`);
                            }
                        }
                    }
                    
                    // metric_change: Track cumulative metric changes
                    if (obj.type === 'metric_change' && passed && policyEffects[obj.target.metric]) {
                        const change = policyEffects[obj.target.metric];
                        obj.progress = (obj.progress || 0) + change;
                        
                        const targetChange = obj.target.change;
                        const achieved = targetChange > 0 ? obj.progress >= targetChange : obj.progress <= targetChange;
                        
                        if (achieved && !obj.completed) {
                            obj.completed = true;
                            console.log(`   🎉 ${faction.name} COMPLETED: ${obj.text} (${obj.progress} points)`);
                        }
                    }
                });
                
                // Check if all objectives complete for +10% bonus
                const allObjectives = faction.objectives.filter(o => true);
                const completedCount = allObjectives.filter(o => o.completed).length;
                const allComplete = allObjectives.every(o => o.completed);
                
                if (allComplete && !faction.objectivesBonus) {
                    faction.objectivesBonus = true;
                    faction.voterApproval = Math.min(100, (faction.voterApproval || 50) + 10);
                    console.log(`   🏆 ${faction.name} completed ALL OBJECTIVES! +10% approval (now ${faction.voterApproval}%)`);
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
                    isLeader: student.isLeader, // CRITICAL: Preserve leader status!
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
                    isLeader: student.isLeader, // Preserve leader status
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
                    let currentValue, targetValue, passes;
                    
                    // Check if it's a token objective or metrics objective
                    if (obj.target.metric === 'tokens') {
                        currentValue = faction.tokens.capital || 0;
                        targetValue = obj.target.value;
                        passes = obj.target.operator === '>=' ? 
                            currentValue >= targetValue : 
                            (obj.target.operator === '>' ? currentValue > targetValue : currentValue < targetValue);
                    } else {
                        currentValue = game.metrics[obj.target.metric];
                        targetValue = obj.target.value;
                        passes = obj.target.operator === '>' ? 
                            currentValue > targetValue : 
                            currentValue < targetValue;
                    }
                    
                    if (passes) {
                        obj.completed = true;
                        console.log(`  ✅ ${faction.name} completed: ${obj.text} (${currentValue} vs ${targetValue})`);
                    } else {
                        console.log(`  ❌ ${faction.name} failed: ${obj.text} (${currentValue} vs ${targetValue})`);
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
                faction.voterApproval = Math.min(100, (faction.voterApproval || 50) + 10);
                console.log(`  🏆 ${faction.name} completed all objectives! +10% approval (now ${faction.voterApproval}%)`);
            }
        });
        
        // Calculate final scores: 50% Voter Approval + 50% Political Capital
        game.factions.forEach(faction => {
            const approvalScore = (faction.voterApproval || 50);
            const capitalScore = (faction.tokens.capital || 0) * 5; // Each token worth 5 points
            faction.finalScore = (approvalScore * 0.5) + (capitalScore * 0.5);
            
            console.log(`\n📊 ${faction.name} Final Score Calculation:`);
            console.log(`   Voter Approval: ${approvalScore}% (50% weight = ${(approvalScore * 0.5).toFixed(1)})`);
            console.log(`   Political Capital: ${faction.tokens.capital} tokens = ${capitalScore} points (50% weight = ${(capitalScore * 0.5).toFixed(1)})`);
            console.log(`   TOTAL SCORE: ${faction.finalScore.toFixed(1)}`);
        });
        
        // Sort factions by final score
        const rankedFactions = [...game.factions].sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
        const winner = rankedFactions[0];
        
        console.log(`\n🏆 GAME OVER!`);
        console.log(`🥇 Winner: ${winner.name} (Score: ${winner.finalScore.toFixed(1)})`);
        console.log(`   ${winner.voterApproval}% approval + ${winner.tokens.capital} tokens`);
        console.log(`\n📊 Final Rankings:`);
        rankedFactions.forEach((f, i) => {
            console.log(`  ${i + 1}. ${f.name}: ${f.finalScore.toFixed(1)} points (${f.voterApproval}% approval, ${f.tokens.capital} tokens)`);
        });
        
        io.emit('gameEnded', {
            winner: winner,
            factions: rankedFactions
        });
        
        // Reset game state for next game
        game.started = false;
        game.currentRound = 1;
        game.currentPhase = 'setup';
        game.factions = [];
    });
    
    // Scandal Campaign - steal approval from another faction
    socket.on('scandalCampaign', (data) => {
        console.log(`\n📰 SCANDAL CAMPAIGN by ${data.attackerId} targeting ${data.targetId}`);
        
        const student = game.students[socket.id];
        if (!student) return;
        
        // Only leaders can launch scandals
        if (!student.isLeader) {
            console.log(`  ❌ ${student.name} tried to launch scandal but is not leader`);
            io.to(socket.id).emit('scandalFailed', { reason: 'Only faction leaders can launch scandal campaigns' });
            return;
        }
        
        const attacker = game.factions.find(f => f.id === data.attackerId);
        const target = game.factions.find(f => f.id === data.targetId);
        
        if (!attacker || !target) {
            console.log('⚠️ Invalid factions');
            return;
        }
        
        // Check if attacker has at least 1 token
        if ((attacker.tokens.capital || 0) < 1) {
            io.to(socket.id).emit('scandalFailed', { reason: 'Not enough political capital (need 1 token)' });
            console.log(`❌ ${attacker.name} doesn't have enough tokens`);
            return;
        }
        
        // Execute scandal
        attacker.tokens.capital -= 1;
        attacker.voterApproval = Math.min(100, (attacker.voterApproval || 50) + 2);
        target.voterApproval = Math.max(0, (target.voterApproval || 50) - 2);
        
        console.log(`✅ Scandal executed!`);
        console.log(`   ${attacker.name}: -1 token, +2% approval (now ${attacker.voterApproval}%)`);
        console.log(`   ${target.name}: -2% approval (now ${target.voterApproval}%)`);
        
        // Broadcast the scandal to all players
        io.emit('scandalExecuted', {
            attacker: attacker.name,
            attackerId: attacker.id,
            target: target.name,
            targetId: target.id,
            attackerApproval: attacker.voterApproval,
            targetApproval: target.voterApproval
        });
        
        // Update everyone with new game state
        io.emit('gameState', game);
        
        // Update all students
        Object.keys(game.students).forEach(socketId => {
            const student = game.students[socketId];
            const faction = game.factions.find(f => f.id === student.factionId);
            if (faction) {
                io.to(socketId).emit('yourFaction', {
                    faction: faction,
                    isLeader: student.isLeader, // Preserve leader status
                    allFactions: game.factions.map(f => ({ id: f.id, name: f.name, icon: f.icon, color: f.color }))
                });
            }
        });
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`\n❌ Client disconnected: ${socket.id.substring(0, 12)}`);
        
        // Remove from students if applicable
        if (game.students[socket.id]) {
            delete game.students[socket.id];
            
            // Update teacher
            if (game.teacherSocket) {
                io.to(game.teacherSocket).emit('studentsUpdate', Object.values(game.students));
            }
        }
    });
});

http.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎮 Coalition Game Server v3.0`);
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
