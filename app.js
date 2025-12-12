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
// REFERENCIA A REALTIME DATABASE (RTDB)
const rtdb = firebase.database(); 

// --- 2. REFERENCIAS A ELEMENTOS DEL DOM ---
// Contenedores de pantallas
const authScreen = document.getElementById('auth-screen');
const setupScreen = document.getElementById('setup-screen');
const lobbyScreen = document.getElementById('game-lobby');
const customLobbyScreen = document.getElementById('custom-lobby');

// Botones y campos de perfil
const btnGoogleSignIn = document.getElementById('btn-google-signin');
const btnGuardarPerfil = document.getElementById('btn-guardar-perfil');
const inputNickname = document.getElementById('input-nickname');
const inputNombreFijo = document.getElementById('input-nombre-fijo');
const nombreFijoError = document.getElementById('nombre-fijo-error');
const lobbyNickname = document.getElementById('lobby-nickname');

// Botones de navegación (Deben existir en el HTML)
const btnJugar = document.getElementById('btn-jugar'); // Aunque no lo uses aún, es buena práctica referenciarlo
const btnPerfil = document.getElementById('btn-perfil');

// Botones de Lobby
const btnHost = document.getElementById('btn-host');
const btnJoin = document.getElementById('btn-join');


// --- 3. FUNCIÓN PARA CAMBIAR DE PANTALLA ---

function showScreen(screen) {
    // Ocultar todas las secciones principales
    authScreen.style.display = 'none';
    setupScreen.style.display = 'none';
    lobbyScreen.style.display = 'none';
    customLobbyScreen.style.display = 'none'; 
    document.getElementById('game-play-screen').style.display = 'none';

    // Manejar visibilidad de botones del header
    const userIsAuthenticated = !!auth.currentUser;
    btnJugar.style.display = 'none';
    btnPerfil.style.display = 'none';

    if (userIsAuthenticated) {
        btnPerfil.style.display = 'inline-block';
        if (screen === 'lobby' || screen === 'custom-lobby') {
             btnJugar.style.display = 'inline-block';
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
    }
}


// --- 4. GESTIÓN DE LA AUTENTICACIÓN Y ESTADO INICIAL ---

btnGoogleSignIn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .catch((error) => {
            console.error("Error al iniciar sesión con Google:", error.message);
            // Mostrar error en la interfaz o un alert
            alert(`Error de autenticación: ${error.message}`);
        });
});

// Listener principal para el estado de autenticación
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


// --- 5. GESTIÓN DE PERFIL (Primer Acceso) ---

// Habilitar el botón si ambos campos están llenos
[inputNickname, inputNombreFijo].forEach(input => {
    input.addEventListener('input', () => {
        btnGuardarPerfil.disabled = !(inputNickname.value.trim() && inputNombreFijo.value.trim());
    });
});

// Listener para guardar el perfil y verificar unicidad
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


// --- 6. LÓGICA DE SALAS MULTIJUGADOR (HOST Y JOIN) ---

// Genera un código de 7 dígitos al azar
function generateRoomCode() {
    return Math.floor(1000000 + Math.random() * 9000000).toString();
}

// ----------------------------------------------------
// A. CREAR PARTIDA (HOST)
// ----------------------------------------------------
btnHost.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return alert("Debes iniciar sesión.");

    const code = generateRoomCode();
    
    // Obtener el perfil del host
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
                status: 'ready',
                voted: false,
                strikes: 0
            }
        },
        maxPlayers: 30, 
        roundCount: 0, 
        currentRound: 0,
        currentTurnUID: user.uid, 
        createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    try {
        await rtdb.ref(`rooms/${code}`).set(roomData);
        alert(`Partida creada. Código: ${code}. ¡Compártelo!`);
        
        enterLobbyScreen(code, true);

    } catch (error) {
        console.error("Error al crear la sala:", error);
        alert("Error al crear la sala. Intenta de nuevo.");
    }
});

// ----------------------------------------------------
// B. UNIRSE A PARTIDA (JOIN)
// ----------------------------------------------------
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
        return alert("Error: La partida ya ha comenzado o ha terminado.");
    }

    if (playersCount >= roomData.maxPlayers) {
        return alert("Error: La sala está llena.");
    }

    // Si ya está en la sala, lo llevamos a la pantalla sin re-añadirlo
    if (roomData.players && roomData.players[user.uid]) {
         enterLobbyScreen(code, roomData.hostId === user.uid);
         return;
    }


    // Obtener el perfil del jugador
    const userDoc = await db.collection('users').doc(user.uid).get();
    const playerData = userDoc.data();

    // Añadir el jugador a la lista de la sala
    const playerUpdate = {
        nickname: playerData.nickname,
        role: null,
        status: 'ready',
        voted: false,
        strikes: 0
    };

    try {
        await roomRef.child(`players/${user.uid}`).set(playerUpdate);
        alert(`Te has unido a la sala ${code}.`);

        enterLobbyScreen(code, false);

    } catch (error) {
        console.error("Error al unirse a la sala:", error);
        alert("Error al unirse a la sala.");
    }
}

// ----------------------------------------------------
// C. PANTALLA DE SALA DE ESPERA (RENDERIZADO Y LISTENERS)
// ----------------------------------------------------

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
    
    // Listener para actualizar la lista de jugadores en tiempo real
    // Usamos 'value' para sincronizar toda la lista
    roomRef.child('players').on('value', (snapshot) => {
        const playersData = snapshot.val();
        const playerListElement = document.getElementById('player-list');
        const playerCountElement = document.getElementById('player-count');

        if (!playerListElement || !playersData) return;

        let html = '';
        const playerUIDs = Object.keys(playersData);
        const count = playerUIDs.length;
        
        playerUIDs.forEach(uid => {
            const player = playersData[uid];
            const isPlayerHost = uid === roomRef.hostId;
            html += `<li style="text-align: left; padding: 5px; border-bottom: 1px solid #313a5a;">
                        ${isPlayerHost ? '👑' : ''} ${player.nickname} 
                        (${uid === auth.currentUser.uid ? 'Tú' : 'Listo'})
                    </li>`;
        });
        
        playerCountElement.textContent = count;
        playerListElement.innerHTML = html;
        
        // Lógica de inicio de juego
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

    // Listener para el botón de salir de sala
    document.getElementById('btn-leave-lobby').addEventListener('click', async () => {
        const currentUserUID = auth.currentUser.uid;
        
        // 1. Remover al jugador de la sala
        await roomRef.child(`players/${currentUserUID}`).remove();
        
        // 2. Detener los listeners de la sala
        roomRef.off();

        // 3. Si el que sale es el Host, borramos toda la sala
        if (isHost) {
             alert("¡El Host se fue! Cerrando la partida para todos...");
             await roomRef.remove(); 
        } else {
             alert("Has salido de la sala.");
        }
        
        showScreen('lobby');
    });

    // Listener para INICIAR JUEGO (Solo Host)
    if (isHost) {
        document.getElementById('btn-start-game').addEventListener('click', () => {
             // **PRÓXIMO PASO: Implementar la lógica de Asignación de Roles**
             alert("¡Juego iniciado! Preparando asignación de roles y palabra secreta...");
             // setRoomStatus(code, 'in_game'); // Se implementará luego
        });
    }

    // Listener para detectar que la sala ha sido eliminada por el host (solo para invitados)
    if (!isHost) {
        roomRef.on('value', (snapshot) => {
            if (!snapshot.exists() && customLobbyScreen.style.display === 'block') {
                roomRef.off(); 
                alert("El Host ha cerrado la partida. Volviendo al lobby.");
                showScreen('lobby');
            }
        });
    }
}
