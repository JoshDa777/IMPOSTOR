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
const roundDisplay = document.getElementById('round-display'); 
const currentTurnPlayer = document.getElementById('current-turn-player');
const timerDisplay = document.getElementById('timer-display');
const btnEndTurn = document.getElementById('btn-end-turn');
const btnStartVote = document.getElementById('btn-start-vote'); 
const votingArea = document.getElementById('voting-area');
const votingTitle = document.getElementById('voting-title');
const votePlayerList = document.getElementById('vote-player-list');

let currentRoomCode = null;
let gameTimerInterval = null;


// --- 3. DICCIONARIO Y LÓGICA DE ROLES ---
const wordsDictionary = [
    { civil: "Tierra", impostor: "Marte" },
    { civil: "Fuego", impostor: "Humo" },
    { civil: "Mesa", impostor: "Silla" },
    { civil: "Sol", impostor: "Luna" },
    { civil: "Perro", impostor: "Gato" },
    { civil: "Verano", impostor: "Invierno" },
];

function assignRoles(playersData) {
    const uids = Object.keys(playersData);
    const numPlayers = uids.length;

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
            isEliminated: false 
        };
    });

    console.log(`Roles asignados. Impostor: ${playersData[impostorUid].nickname}. Palabra Civil: ${civilWord}.`);

    return { updatedPlayers, civilWord, impostorWord };
}


// --- 4. FUNCIÓN PARA CAMBIAR DE PANTALLA Y CORRECCIÓN DE ADSENSE ---

function showScreen(screen) {
    // Ocultar todas las secciones principales
    authScreen.style.display = 'none';
    setupScreen.style.display = 'none';
    lobbyScreen.style.display = 'none';
    customLobbyScreen.style.display = 'none'; 
    gamePlayScreen.style.display = 'none'; 
    document.getElementById('game-play-screen').style.display = 'none'; 

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
        
        // 🚨 CORRECCIÓN ADSENSE: Forzar la carga de anuncios solo cuando el contenedor es visible
        if (window.adsbygoogle) {
             (window.adsbygoogle = window.adsbygoogle || []).push({});
        }

    } else if (screen === 'custom-lobby') { 
        customLobbyScreen.style.display = 'block';
    } else if (screen === 'game') {
        gamePlayScreen.style.display = 'block';
    }
}


// --- 5. GESTIÓN DE LA AUTENTICACIÓN ---

btnGoogleSignIn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .catch((error) => {
            console.error("Error al iniciar sesión con Google:", error.message);
            alert(`Error de autenticación. Verifica la consola de Firebase: ${error.message}`);
        });
});

auth.onAuthStateChanged(async (user) => {
    if (user) {
        const userDocRef = db.collection('users').doc(user.uid);
        const userDoc = await userDocRef.get();

        if (userDoc.exists) {
            showScreen('lobby');
            lobbyNickname.textContent = userDoc.data().nickname;
        } else {
            showScreen('setup');
        }

    } else {
        showScreen('auth');
    }
});


// --- 6. GESTIÓN DE PERFIL ---

[inputNickname, inputNombreFijo].forEach(input => {
    input.addEventListener('input', () => {
        btnGuardarPerfil.disabled = !(inputNickname.value.trim() && inputNombreFijo.value.trim());
    });
});

btnGuardarPerfil.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return; 

    const nickname = inputNickname.value.trim();
    const nombreFijo = inputNombreFijo.value.trim().toLowerCase();

    btnGuardarPerfil.disabled = true;
    nombreFijoError.style.display = 'none';
    nombreFijoError.textContent = '';

    if (nombreFijo.includes(' ') || nombreFijo.length < 3) {
        nombreFijoError.textContent = "El Nombre Fijo no puede tener espacios y debe tener al menos 3 caracteres.";
        nombreFijoError.style.display = 'block';
        btnGuardarPerfil.disabled = false;
        return;
    }

    try {
        await db.runTransaction(async (transaction) => {
            const nombreFijoDocRef = db.collection('nombres_fijos_registrados').doc(nombreFijo);
            const nombreFijoDoc = await transaction.get(nombreFijoDocRef);

            if (nombreFijoDoc.exists) {
                throw new Error("Nombre Fijo ya en uso.");
            }

            transaction.set(nombreFijoDocRef, { uid: user.uid });
            
            const userDocRef = db.collection('users').doc(user.uid);
            transaction.set(userDocRef, {
                uid: user.uid,
                email: user.email,
                nickname: nickname,
                nombreFijo: nombreFijo,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                stats: {
                    victoriasImpostor: 0,
                    victoriasCivil: 0,
                    puntosExperiencia: 0
                }
            });
        });

        alert("¡Perfil creado exitosamente! Bienvenido.");
        showScreen('lobby');
        lobbyNickname.textContent = nickname;

    } catch (error) {
        console.error("Error en la creación del perfil:", error);
        
        if (error.message && error.message.includes("Nombre Fijo ya en uso.")) {
            nombreFijoError.textContent = "Ese Nombre Fijo ya está registrado. Intenta con otro.";
        } else {
            nombreFijoError.textContent = "Ocurrió un error al guardar. Intenta de nuevo.";
        }
        nombreFijoError.style.display = 'block';
        btnGuardarPerfil.disabled = false;
    }
});


// --- 7. LÓGICA DE SALAS MULTIJUGADOR (HOST Y JOIN) ---

function generateRoomCode() {
    return Math.floor(1000000 + Math.random() * 9000000).toString();
}

btnHost.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return alert("Debes iniciar sesión.");

    const code = generateRoomCode();
    
    const userDoc = await db.collection('users').doc(user.uid).get();
    const hostData = userDoc.data();

    const roomData = {
        code: code,
        hostId: user.uid,
        hostName: hostData.nickname,
        status: 'waiting', 
        players: {
            [user.uid]: { 
                nickname: hostData.nickname,
                role: null, 
                word: null, 
                status: 'ready',
                voted: false,
                strikes: 0,
                isEliminated: false
            }
        },
        maxPlayers: 30, 
        roundCount: 0, 
        currentRound: 0,
        currentTurnUID: user.uid, 
        currentWord: null, 
        currentImpostorWord: null, 
        createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    try {
        await rtdb.ref(`rooms/${code}`).set(roomData);
        alert(`Partida creada. Código: ${code}. ¡Compártelo!`);
        currentRoomCode = code;
        enterLobbyScreen(code, true);

    } catch (error) {
        console.error("Error al crear la sala:", error);
        alert("Error al crear la sala. Intenta de nuevo.");
    }
});

btnJoin.addEventListener('click', () => {
    const user = auth.currentUser;
    if (!user) return alert("Debes iniciar sesión.");

    const code = prompt("Introduce el código de 7 dígitos de la sala:");
    if (!code || code.length !== 7 || isNaN(code)) return alert("Código inválido. Debe ser de 7 números.");

    joinRoom(code, user);
});

async function joinRoom(code, user) {
    const roomRef = rtdb.ref(`rooms/${code}`);
    const roomSnapshot = await roomRef.once('value');

    if (!roomSnapshot.exists()) {
        return alert("Error: La sala con ese código no existe.");
    }
    
    const roomData = roomSnapshot.val();
    const playersCount = Object.keys(roomData.players || {}).length;

    if (roomData.status !== 'waiting') {
        if (roomData.players && roomData.players[user.uid] && roomData.status === 'in_game') {
             currentRoomCode = code;
             enterGameScreen(code);
             return;
        }
        return alert("Error: La partida ya ha comenzado o ha terminado.");
    }

    if (playersCount >= roomData.maxPlayers) {
        return alert("Error: La sala está llena.");
    }

    if (roomData.players && roomData.players[user.uid]) {
         currentRoomCode = code;
         enterLobbyScreen(code, roomData.hostId === user.uid);
         return;
    }


    const userDoc = await db.collection('users').doc(user.uid).get();
    const playerData = userDoc.data();

    const playerUpdate = {
        nickname: playerData.nickname,
        role: null,
        word: null,
        status: 'ready',
        voted: false,
        strikes: 0,
        isEliminated: false
    };

    try {
        await roomRef.child(`players/${user.uid}`).set(playerUpdate);
        alert(`Te has unido a la sala ${code}.`);
        currentRoomCode = code;
        enterLobbyScreen(code, false);

    } catch (error) {
        console.error("Error al unirse a la sala:", error);
        alert("Error al unirse a la sala.");
    }
}


// --- 8. GESTIÓN DE SALA DE ESPERA Y START GAME ---

function enterLobbyScreen(code, isHost) {
    showScreen('custom-lobby');
    customLobbyScreen.innerHTML = `
        <h2 style="color: #4a69bd;">Sala ${code}</h2>
        <p>Esperando jugadores... (Jugadores: <span id="player-count">1</span>)</p>
        <p>Eres el **${isHost ? '👑 HOST' : '🔗 INVITADO'}**</p>

        <div id="player-list-container">
            <ul id="player-list" style="list-style: none; padding: 0;"></ul>
        </div>

        <div style="margin-top: 30px;">
            ${isHost ? '<button id="btn-start-game" style="background-color: #27ae60;">INICIAR JUEGO (Mínimo 4)</button>' : ''}
            <button id="btn-leave-lobby" style="background-color: #e74c3c;">❌ Salir de Sala</button>
        </div>
        <p style="margin-top: 20px;">**NOTA:** El Host (anfitrión) debe permanecer en la sala para que no se cierre.</p>
    `;
    
    setupRoomListeners(code, isHost);
}

function setupRoomListeners(code, isHost) {
    const roomRef = rtdb.ref(`rooms/${code}`);
    
    roomRef.on('value', (snapshot) => {
        const roomData = snapshot.val();
        
        if (!roomData) {
             roomRef.off();
             if (customLobbyScreen.style.display === 'block' || gamePlayScreen.style.display === 'block') {
                 alert("La partida ha sido cerrada por el Host.");
                 showScreen('lobby');
             }
             return;
        }

        if (roomData.status === 'in_game' && customLobbyScreen.style.display === 'block') {
             enterGameScreen(code);
             return;
        }


        const playersData = roomData.players;
        const playerListElement = document.getElementById('player-list');
        const playerCountElement = document.getElementById('player-count');

        if (!playerListElement || !playersData) return;

        let html = '';
        const playerUIDs = Object.keys(playersData);
        const count = playerUIDs.length;
        
        playerUIDs.forEach(uid => {
            const player = playersData[uid];
            const isPlayerHost = uid === roomData.hostId;
            html += `<li style="text-align: left; padding: 5px; border-bottom: 1px solid #313a5a;">
                        ${isPlayerHost ? '👑' : ''} ${player.nickname} 
                        (${uid === auth.currentUser.uid ? 'Tú' : 'Listo'})
                    </li>`;
        });
        
        playerCountElement.textContent = count;
        playerListElement.innerHTML = html;
        
        const btnStart = document.getElementById('btn-start-game');
        if (isHost && btnStart) {
            btnStart.disabled = (count < 4); 
            if (count >= 4) {
                 btnStart.textContent = `INICIAR JUEGO (${count} jugadores)`;
            } else {
                 btnStart.textContent = `INICIAR JUEGO (Mínimo 4)`;
            }
        }
    });

    const btnLeaveLobby = document.getElementById('btn-leave-lobby');
    if (btnLeaveLobby) {
        btnLeaveLobby.onclick = async () => {
            const currentUserUID = auth.currentUser.uid;
            
            await roomRef.child(`players/${currentUserUID}`).remove();
            
            roomRef.off(); 
            currentRoomCode = null;

            if (isHost) {
                 alert("¡El Host se fue! Cerrando la partida para todos...");
                 await roomRef.remove(); 
            } else {
                 alert("Has salido de la sala.");
            }
            showScreen('lobby');
        };
    }
    
    if (isHost) {
        const btnStart = document.getElementById('btn-start-game');
        if (btnStart) {
            btnStart.onclick = () => startGame(code);
        }
    }
}

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
            voting: { 
                status: 'discussion', // discussion, voting, results
                votes: {},
                accusedUID: null
            },
            turnStartTime: firebase.database.ServerValue.TIMESTAMP 
        };

        await roomRef.update(updates);
        console.log(`Juego ${code} iniciado.`);

    } catch (error) {
        console.error("Error al iniciar el juego:", error);
        alert(`No se pudo iniciar el juego: ${error.message}`);
    }
}


// --- 9. LÓGICA DE TURNO Y VOTACIÓN (FASE 4) ---

function getNextTurnUID(players, currentUID) {
    const uids = Object.keys(players).sort(); 
    let currentIndex = uids.indexOf(currentUID);
    let nextIndex = (currentIndex + 1) % uids.length;
    let originalIndex = currentIndex;

    while (players[uids[nextIndex]].isEliminated) {
        nextIndex = (nextIndex + 1) % uids.length;
        if (nextIndex === originalIndex) {
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
            return;
        }

        const players = roomData.players;
        const nextUID = getNextTurnUID(players, currentTurnUID);

        if (!nextUID) {
             // Esto se manejará en la Fase 5: Comprobación de Victoria
             roomData.status = 'finished';
        } else {
            roomData.currentTurnUID = nextUID;
            roomData.turnStartTime = firebase.database.ServerValue.TIMESTAMP;
            
            const playerUIDs = Object.keys(players).sort();
            if (nextUID === playerUIDs[0]) { 
                 roomData.currentRound += 1;
            }
        }

        return roomData;
    });
}

async function handleStrike(code, targetUID) {
    const roomRef = rtdb.ref(`rooms/${code}`);
    
    await rtdb.runTransaction(roomSnapshot => {
        const roomData = roomSnapshot.val();
        if (!roomData) return;

        const player = roomData.players[targetUID];
        if (player) {
            player.strikes = (player.strikes || 0) + 1;
            
            if (player.strikes >= 2) {
                player.isEliminated = true;
                player.status = 'eliminated';
                alert(`${player.nickname} ha sido eliminado por acumular 2 strikes!`);
            }
        }
        return roomData;
    });
}

async function startVotingPhase(code, accusedUID = null) {
    const roomRef = rtdb.ref(`rooms/${code}`);
    
    await roomRef.child('voting').update({
        status: 'voting',
        votes: {}, 
        accusedUID: accusedUID, 
        startTime: firebase.database.ServerValue.TIMESTAMP
    });
    alert("¡Votación iniciada! Elijan un jugador.");
}

async function registerVote(code, voterUID, targetUID) {
    const roomRef = rtdb.ref(`rooms/${code}`);
    
    await rtdb.child(`rooms/${code}/voting/votes/${targetUID}/${voterUID}`).set(true);

    const roomSnapshot = await roomRef.once('value');
    const roomData = roomSnapshot.val();
    alert(`Tu voto por ${roomData.players[targetUID].nickname} ha sido registrado.`); 
}


// --- 10. GESTIÓN DE PANTALLA DE JUEGO (Actualizada) ---

function enterGameScreen(code) {
    showScreen('game');
    currentRoomCode = code;
    const roomRef = rtdb.ref(`rooms/${code}`);
    const currentUserUID = auth.currentUser.uid;
    
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    
    btnEndTurn.onclick = () => handleEndTurn(code, currentUserUID);
    btnStartVote.onclick = () => startVotingPhase(code); 

    roomRef.on('value', (snapshot) => {
        const roomData = snapshot.val();
        if (!roomData || roomData.status !== 'in_game') {
            roomRef.off();
            if (roomData && roomData.status === 'finished') alert("Juego terminado.");
            showScreen('lobby');
            return;
        }

        const myPlayer = roomData.players[currentUserUID];
        const isMyTurn = roomData.currentTurnUID === currentUserUID;

        roleDisplay.textContent = `TU ROL: ${myPlayer.role.toUpperCase()}`;
        wordDisplay.textContent = `PALABRA: ${myPlayer.word}`;
        roleDisplay.style.color = myPlayer.role === 'impostor' ? '#e74c3c' : '#27ae60';
        wordDisplay.style.color = myPlayer.role === 'impostor' ? '#e74c3c' : '#27ae60';
        roundDisplay.textContent = roomData.currentRound;

        const turnPlayer = roomData.players[roomData.currentTurnUID];
        currentTurnPlayer.textContent = turnPlayer ? turnPlayer.nickname : 'N/A';
        btnEndTurn.style.display = isMyTurn && roomData.voting.status === 'discussion' ? 'inline-block' : 'none';
        
        startLocalTimer(roomData, currentUserUID);
        
        renderVotingArea(roomData, currentUserUID);
        
        renderGamePlayerList(roomData);
        
        // (FASE 5: Comprobar Ganador se implementará aquí)
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

    const turnStartTime = roomData.turnStartTime || Date.now();
    const maxTime = 60; 
    
    gameTimerInterval = setInterval(async () => {
        const serverTimeMs = Date.now(); 
        const elapsedTime = Math.floor((serverTimeMs - turnStartTime) / 1000);
        let timeLeft = maxTime - elapsedTime;
        
        if (timeLeft <= 0) {
            clearInterval(gameTimerInterval);
            timerDisplay.textContent = "¡TIEMPO AGOTADO!";
            
            if (roomData.currentTurnUID === currentUserUID) {
                await handleStrike(currentRoomCode, currentUserUID);
                await handleEndTurn(currentRoomCode, currentUserUID);
            }
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
