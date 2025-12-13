// --- 1. CONFIGURACIÓN DE FIREBASE (TU INFORMACIÓN REAL) ---
const firebaseConfig = {
    apiKey: "AIzaSyCdAcZZT5E-vgVlM9ENDqcFO-R-lCInHbQ",
    authDomain: "impostor-cea0e.firebaseapp.com",
    projectId: "impostor-cea0e",
    storageBucket: "impostor-cea0e.firebasestorage.app",
    messagingSenderId: "109313260810",
    appId: "1:109313260810:web:a07c8bddc24ef22e688ef3"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);

// Referencias a los servicios
const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database(); 

// --- 2. REFERENCIAS A ELEMENTOS DEL DOM ---
const authScreen = document.getElementById('auth-screen');
const setupScreen = document.getElementById('setup-screen');
const lobbyScreen = document.getElementById('game-lobby');
const customLobbyScreen = document.getElementById('custom-lobby');
const gamePlayScreen = document.getElementById('game-play-screen'); 

const btnGoogleSignIn = document.getElementById('btn-google-signin');
const btnGuardarPerfil = document.getElementById('btn-guardar-perfil');
const inputNickname = document.getElementById('input-nickname');
const inputNombreFijo = document.getElementById('input-nombre-fijo');
const nombreFijoError = document.getElementById('nombre-fijo-error');
const lobbyNickname = document.getElementById('lobby-nickname');

const btnHost = document.getElementById('btn-host');
const btnJoin = document.getElementById('btn-join');

// Elementos de la pantalla de JUEGO
const roleDisplay = document.getElementById('role-display');
const wordDisplay = document.getElementById('word-display');
const roundDisplay = document.getElementById('round-display'); // NUEVO: para mostrar la ronda
const currentTurnPlayer = document.getElementById('current-turn-player');
const timerDisplay = document.getElementById('timer-display');
const btnEndTurn = document.getElementById('btn-end-turn');
const btnStartVote = document.getElementById('btn-start-vote'); // NUEVO: Botón de Acusar/Votación
const votingArea = document.getElementById('voting-area');
const votingTitle = document.getElementById('voting-title');
const votePlayerList = document.getElementById('vote-player-list');

// Variable global para la sala actual y el temporizador
let currentRoomCode = null;
let gameTimerInterval = null;


// --- 3. DICCIONARIO Y LÓGICA DE ROLES (MISMO CÓDIGO) ---
const wordsDictionary = [
    { civil: "Tierra", impostor: "Marte" },
    { civil: "Fuego", impostor: "Humo" },
    { civil: "Mesa", impostor: "Silla" },
    { civil: "Sol", impostor: "Luna" },
    { civil: "Perro", impostor: "Gato" },
    { civil: "Verano", impostor: "Invierno" },
];

function assignRoles(playersData) {
    // ... (El código de assignRoles es el mismo, no lo repito para ahorrar espacio) ...
    const uids = Object.keys(playersData);
    const numPlayers = uids.length;
    const numImpostors = 1; 

    if (numPlayers < 4) {
        throw new Error("Se necesitan al menos 4 jugadores para iniciar.");
    }

    const selectedWords = wordsDictionary[Math.floor(Math.random() * wordsDictionary.length)];
    const civilWord = selectedWords.civil;
    const impostorWord = selectedWords.impostor;

    const impostorUid = uids[Math.floor(Math.random() * numPlayers)];
    
    const updatedPlayers = {};
    
    uids.forEach(uid => {
        const isImpostor = uid === impostorUid;
        updatedPlayers[uid] = {
            ...playersData[uid],
            role: isImpostor ? 'impostor' : 'civil',
            word: isImpostor ? impostorWord : civilWord,
            isTurn: false, 
            strikes: 0,
            isEliminated: false // NUEVO: Para saber si está fuera del juego
        };
    });

    console.log(`Roles asignados. Impostor: ${playersData[impostorUid].nickname}. Palabra Civil: ${civilWord}.`);

    return { updatedPlayers, civilWord, impostorWord };
}


// --- 4. FUNCIÓN PARA CAMBIAR DE PANTALLA (MISMO CÓDIGO) ---

function showScreen(screen) {
    // ... (El código de showScreen es el mismo, asegura que se muestre gamePlayScreen) ...
    authScreen.style.display = 'none';
    setupScreen.style.display = 'none';
    lobbyScreen.style.display = 'none';
    customLobbyScreen.style.display = 'none'; 
    gamePlayScreen.style.display = 'none'; 
    document.getElementById('game-play-screen').style.display = 'none'; // Aseguramos que se oculte por ID

    const userIsAuthenticated = !!auth.currentUser;
    document.getElementById('btn-jugar').style.display = 'none';
    document.getElementById('btn-perfil').style.display = 'none';

    if (userIsAuthenticated) {
        document.getElementById('btn-perfil').style.display = 'inline-block';
        if (screen === 'lobby' || screen === 'custom-lobby') {
             document.getElementById('btn-jugar').style.display = 'inline-block';
        }
    }


    if (screen === 'auth') {
        authScreen.style.display = 'block';
    } else if (screen === 'setup') {
        setupScreen.style.display = 'block';
    } else if (screen === 'lobby') {
        lobbyScreen.style.display = 'block';
    } else if (screen === 'custom-lobby') { 
        customLobbyScreen.style.display = 'block';
    } else if (screen === 'game') {
        gamePlayScreen.style.display = 'block';
    }
}

// --- 5, 6 y 7. AUTENTICACIÓN, PERFIL Y SALAS (MISMO CÓDIGO) ---
// (No se repiten las secciones de autenticación, perfil, host y join para ahorrar espacio, asume que son las mismas)

// --- LÓGICA ESPECÍFICA DE INICIO DE JUEGO ---

async function startGame(code) {
    const roomRef = rtdb.ref(`rooms/${code}`);
    const roomSnapshot = await roomRef.once('value');
    const roomData = roomSnapshot.val();
    
    if (!roomData || roomData.status !== 'waiting') return;

    const playersData = roomData.players;
    const playersCount = Object.keys(playersData).length;

    if (playersCount < 4) {
        return alert("Necesitas al menos 4 jugadores para iniciar.");
    }

    try {
        const { updatedPlayers, civilWord, impostorWord } = assignRoles(playersData);
        const playerUIDs = Object.keys(updatedPlayers);
        
        // 1. Encontrar el primer jugador activo (no eliminado)
        const activePlayersUIDs = playerUIDs.filter(uid => !updatedPlayers[uid].isEliminated);
        const firstTurnUID = activePlayersUIDs[Math.floor(Math.random() * activePlayersUIDs.length)]; 

        const updates = {
            status: 'in_game',
            currentWord: civilWord,
            currentImpostorWord: impostorWord,
            currentTurnUID: firstTurnUID,
            players: updatedPlayers,
            roundCount: activePlayersUIDs.length, 
            currentRound: 1,
            voting: { // NUEVO: Objeto para la votación
                status: 'discussion', // discussion, voting, results
                votes: {},
                accusedUID: null
            },
            // Usamos un timestamp de inicio de turno para el cálculo del temporizador
            turnStartTime: firebase.database.ServerValue.TIMESTAMP 
        };

        await roomRef.update(updates);
        console.log(`Juego ${code} iniciado.`);

    } catch (error) {
        console.error("Error al iniciar el juego:", error);
        alert(`No se pudo iniciar el juego: ${error.message}`);
    }
}


// --- 8. LÓGICA DE TURNO Y VOTACIÓN (Fase 4) ---

// Función para encontrar el siguiente jugador en el círculo
function getNextTurnUID(players, currentUID) {
    const uids = Object.keys(players).sort(); // Ordenar alfabéticamente por UID
    let currentIndex = uids.indexOf(currentUID);
    let nextIndex = (currentIndex + 1) % uids.length;

    // Buscar el siguiente jugador activo (que no esté eliminado)
    while (players[uids[nextIndex]].isEliminated) {
        nextIndex = (nextIndex + 1) % uids.length;
        if (nextIndex === currentIndex) {
            // Caso borde: Solo queda un jugador (el impostor o el civil)
            return null; 
        }
    }
    return uids[nextIndex];
}

async function handleEndTurn(code, currentTurnUID) {
    const roomRef = rtdb.ref(`rooms/${code}`);

    await rtdb.runTransaction(roomSnapshot => {
        const roomData = roomSnapshot.val();
        if (!roomData || roomData.currentTurnUID !== currentTurnUID) {
            // Alguien más ya cambió el turno
            return;
        }

        const players = roomData.players;
        const nextUID = getNextTurnUID(players, currentTurnUID);

        if (!nextUID) {
             // Juego terminado (Solo queda uno)
             roomData.status = 'finished';
             // Lógica para determinar si el último es el impostor o el civil
        } else {
            // Cambiar turno
            roomData.currentTurnUID = nextUID;
            roomData.turnStartTime = firebase.database.ServerValue.TIMESTAMP;
            
            // Verificar si la ronda ha terminado
            const playerUIDs = Object.keys(players).sort();
            if (nextUID === playerUIDs[0]) { // Asumimos que el primer UID en el array ordenado inicia la ronda
                 roomData.currentRound += 1;
            }
        }

        return roomData;
    });
}

// Función para manejar el Strike (tiempo agotado o acción incorrecta)
async function handleStrike(code, targetUID) {
    const roomRef = rtdb.ref(`rooms/${code}`);
    
    await rtdb.runTransaction(roomSnapshot => {
        const roomData = roomSnapshot.val();
        if (!roomData) return;

        const player = roomData.players[targetUID];
        if (player) {
            player.strikes = (player.strikes || 0) + 1;
            
            // Si tiene 2 strikes, es eliminado (regla de 2 strikes)
            if (player.strikes >= 2) {
                player.isEliminated = true;
                player.status = 'eliminated';
                alert(`${player.nickname} ha sido eliminado por acumular 2 strikes!`);
                // Lógica para comprobar fin de juego
            }
        }
        return roomData;
    });
}

// ------------------------------------------
// LÓGICA DE VOTACIÓN
// ------------------------------------------

// Iniciar la votación (disparada por btn-start-vote)
async function startVotingPhase(code, accusedUID = null) {
    const roomRef = rtdb.ref(`rooms/${code}`);
    
    await roomRef.child('voting').update({
        status: 'voting',
        votes: {}, // Limpiar votos anteriores
        accusedUID: accusedUID, // Si hay un acusado específico (ej: por Strike)
        startTime: firebase.database.ServerValue.TIMESTAMP
    });
    alert("¡Votación iniciada! Elijan un jugador.");
}

// Registrar un voto
async function registerVote(code, voterUID, targetUID) {
    const roomRef = rtdb.ref(`rooms/${code}`);
    
    // El voto se registra en /rooms/{code}/voting/votes/{targetUID}/{voterUID}: true
    await roomRef.child(`voting/votes/${targetUID}/${voterUID}`).set(true);

    alert(`Tu voto por ${targetUID} ha sido registrado.`);
    // La función principal del listener manejará el fin de la votación
}


// --- 9. GESTIÓN DE PANTALLA DE JUEGO (Actualizada) ---

function enterGameScreen(code) {
    showScreen('game');
    currentRoomCode = code;
    const roomRef = rtdb.ref(`rooms/${code}`);
    const currentUserUID = auth.currentUser.uid;
    
    // Detener cualquier temporizador previo
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    
    // 1. EVENT LISTENERS PARA LA INTERFAZ DE JUEGO
    btnEndTurn.onclick = () => handleEndTurn(code, currentUserUID);
    btnStartVote.onclick = () => startVotingPhase(code); // Iniciar votación general

    // 2. LISTENER PRINCIPAL DE LA SALA
    roomRef.on('value', (snapshot) => {
        const roomData = snapshot.val();
        if (!roomData || roomData.status !== 'in_game') {
            roomRef.off();
            if (roomData.status === 'finished') alert("Juego terminado.");
            showScreen('lobby');
            return;
        }

        const myPlayer = roomData.players[currentUserUID];
        const isMyTurn = roomData.currentTurnUID === currentUserUID;

        // A. Actualizar Rol, Palabra y Ronda
        roleDisplay.textContent = `TU ROL: ${myPlayer.role.toUpperCase()}`;
        wordDisplay.textContent = `PALABRA: ${myPlayer.word}`;
        roleDisplay.style.color = myPlayer.role === 'impostor' ? '#e74c3c' : '#27ae60';
        wordDisplay.style.color = myPlayer.role === 'impostor' ? '#e74c3c' : '#27ae60';
        roundDisplay.textContent = roomData.currentRound;

        // B. Gestión de Turno y Temporizador
        const turnPlayer = roomData.players[roomData.currentTurnUID];
        currentTurnPlayer.textContent = turnPlayer ? turnPlayer.nickname : 'N/A';
        btnEndTurn.style.display = isMyTurn && roomData.voting.status === 'discussion' ? 'inline-block' : 'none';
        
        // Iniciar el temporizador visual
        startLocalTimer(roomData, currentUserUID);
        
        // C. Gestión de la Votación
        renderVotingArea(roomData, currentUserUID);
        
        // D. Renderizar lista de jugadores (estado, strikes, etc.)
        renderGamePlayerList(roomData);
        
        // E. (PRÓXIMO PASO: Comprobar Ganador)
    });
}

function startLocalTimer(roomData, currentUserUID) {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    
    const isMyTurn = roomData.currentTurnUID === currentUserUID;
    const isDiscussion = roomData.voting.status === 'discussion';
    
    if (!isMyTurn || !isDiscussion) {
        timerDisplay.textContent = "Esperando turno...";
        return;
    }

    // Calcular tiempo restante basado en el timestamp de inicio (más preciso que un contador local)
    const turnStartTime = roomData.turnStartTime || firebase.database.ServerValue.TIMESTAMP;
    const maxTime = 60; // segundos
    
    gameTimerInterval = setInterval(async () => {
        const serverTimeMs = Date.now(); 
        const elapsedTime = Math.floor((serverTimeMs - turnStartTime) / 1000);
        let timeLeft = maxTime - elapsedTime;
        
        if (timeLeft <= 0) {
            clearInterval(gameTimerInterval);
            timerDisplay.textContent = "¡TIEMPO AGOTADO!";
            // Aplica strike y pasa al siguiente turno (solo el jugador en turno lo hace)
            handleStrike(currentRoomCode, currentUserUID);
            handleEndTurn(currentRoomCode, currentUserUID);
        } else {
            timerDisplay.textContent = timeLeft;
        }
    }, 1000);
}

function renderGamePlayerList(roomData) {
    const list = document.getElementById('game-player-list');
    if (!list) return;

    let html = '';
    const players = roomData.players;
    
    Object.keys(players).forEach(uid => {
        const p = players[uid];
        const isTurn = uid === roomData.currentTurnUID;
        
        let statusText = '';
        if (p.isEliminated) {
            statusText = '💀 ELIMINADO';
        } else if (p.strikes > 0) {
            statusText = `🔥 Faltas: ${p.strikes}`;
        }

        html += `<li style="text-align: left; padding: 5px; border-bottom: 1px dashed #313a5a; opacity: ${p.isEliminated ? 0.5 : 1};">
                    ${isTurn ? '⭐ ' : ''} **${p.nickname}** ${statusText}
                 </li>`;
    });
    list.innerHTML = html;
}

function renderVotingArea(roomData, currentUserUID) {
    const isVoting = roomData.voting.status === 'voting';
    
    btnStartVote.style.display = isVoting ? 'none' : 'inline-block';
    votingTitle.style.display = isVoting ? 'block' : 'none';
    votePlayerList.innerHTML = '';
    
    if (isVoting) {
        const players = roomData.players;
        
        // Contar votos ya emitidos por el jugador
        let hasVoted = false;
        Object.keys(roomData.voting.votes || {}).forEach(targetUID => {
            if (roomData.voting.votes[targetUID] && roomData.voting.votes[targetUID][currentUserUID]) {
                hasVoted = true;
            }
        });
        
        if (hasVoted) {
             votingTitle.textContent = "¡Voto Registrado! Esperando a los demás...";
             return;
        }
        
        // Mostrar lista de jugadores vivos para votar
        Object.keys(players).forEach(targetUID => {
            const p = players[targetUID];
            if (!p.isEliminated && targetUID !== currentUserUID) {
                const voteButton = document.createElement('button');
                voteButton.textContent = `Votar por ${p.nickname}`;
                voteButton.style.backgroundColor = '#8e44ad';
                voteButton.style.margin = '5px';
                voteButton.onclick = () => registerVote(currentRoomCode, currentUserUID, targetUID);
                
                const listItem = document.createElement('li');
                listItem.appendChild(voteButton);
                votePlayerList.appendChild(listItem);
            }
        });
    } else {
         votingTitle.textContent = '';
    }
}
