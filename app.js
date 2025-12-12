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
// REFERENCIA A REALTIME DATABASE (RTDB) para la lógica multijugador
const rtdb = firebase.database(); 

// --- 2. REFERENCIAS A ELEMENTOS DEL DOM ---

const authScreen = document.getElementById('auth-screen');
const setupScreen = document.getElementById('setup-screen');
const lobbyScreen = document.getElementById('game-lobby');
// NUEVOS CONTENEDORES
const customLobbyScreen = document.getElementById('custom-lobby');

const btnGoogleSignIn = document.getElementById('btn-google-signin');
const btnGuardarPerfil = document.getElementById('btn-guardar-perfil');
const inputNickname = document.getElementById('input-nickname');
const inputNombreFijo = document.getElementById('input-nombre-fijo');
const nombreFijoError = document.getElementById('nombre-fijo-error');
const lobbyNickname = document.getElementById('lobby-nickname');

// NUEVOS BOTONES DE LOBBY (Asegúrate de que existan en tu index.html)
const btnHost = document.getElementById('btn-host');
const btnJoin = document.getElementById('btn-join');


// --- 3. FUNCIÓN PARA CAMBIAR DE PANTALLA ---

function showScreen(screen) {
    authScreen.style.display = 'none';
    setupScreen.style.display = 'none';
    lobbyScreen.style.display = 'none';
    customLobbyScreen.style.display = 'none'; // NUEVA PANTALLA
    
    // Ocultar botones del header
    document.getElementById('btn-jugar').style.display = 'none';
    document.getElementById('btn-perfil').style.display = 'none';
    
    if (screen === 'auth') {
        authScreen.style.display = 'block';
    } else if (screen === 'setup') {
        setupScreen.style.display = 'block';
    } else if (screen === 'lobby') {
        lobbyScreen.style.display = 'block';
        document.getElementById('btn-jugar').style.display = 'inline-block';
        document.getElementById('btn-perfil').style.display = 'inline-block';
    } else if (screen === 'custom-lobby') { // NUEVA PANTALLA DE SALA DE ESPERA
        customLobbyScreen.style.display = 'block';
    }
}


// --- 4. GESTIÓN DE LA AUTENTICACIÓN Y ESTADO INICIAL ---

btnGoogleSignIn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .catch((error) => {
            console.error("Error al iniciar sesión con Google:", error.message);
            alert("Error de autenticación. Consulta la consola.");
        });
});

// Listener principal para el estado de autenticación
auth.onAuthStateChanged(async (user) => {
    if (user) {
        console.log("Usuario conectado:", user.uid);
        
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


// --- 5. GESTIÓN DE PERFIL (Primer Acceso y Unicidad) ---

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
        
        if (error.message === "Nombre Fijo ya en uso.") {
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
    
    // 1. Obtener el perfil del host para guardarlo en la sala
    const userDoc = await db.collection('users').doc(user.uid).get();
    const hostData = userDoc.data();

    // 2. Estructura inicial de la sala en Realtime Database
    const roomData = {
        code: code,
        hostId: user.uid,
        hostName: hostData.nickname,
        status: 'waiting', // esperando, in_game, finished
        players: {
            [user.uid]: { // Usamos el UID como clave para cada jugador
                nickname: hostData.nickname,
                role: null, // civil o impostor
                status: 'ready',
                voted: false,
                strikes: 0 // Para marcar las "no palabras" (el 1 rojo)
            }
        },
        maxPlayers: 30, // Máximo de jugadores
        roundCount: 0, // Se calcula (jugadores - 2)
        currentRound: 0,
        currentTurnUID: user.uid, // El host empieza la primera ronda
        createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    try {
        // Guardamos la sala usando el código como clave en la colección 'rooms'
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

    // 1. Obtener el perfil del jugador
    const userDoc = await db.collection('users').doc(user.uid).get();
    const playerData = userDoc.data();

    // 2. Añadir el jugador a la lista de la sala
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
// C. PANTALLA DE SALA DE ESPERA (RENDERIZADO)
// ----------------------------------------------------

// Esta función es temporal para ver si el host/join funciona
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
            ${isHost ? '<button id="btn-start-game" style="background-color: #27ae60;">INICIAR JUEGO (Mínimo 4 jugadores)</button>' : ''}
            <button id="btn-leave-lobby" style="background-color: #e74c3c;">❌ Salir de Sala</button>
        </div>
        <p style="margin-top: 20px;">**NOTA IMPORTANTE:** El Host, si abandona la sala, la partida se CERRARÁ (según tu requisito).</p>
    `;
    
    // Configurar listeners de la sala
    setupRoomListeners(code, isHost);
}

// ----------------------------------------------------
// D. SINCRONIZACIÓN DE LA SALA (ESCUCHAS EN RTDB)
// ----------------------------------------------------
function setupRoomListeners(code, isHost) {
    const roomRef = rtdb.ref(`rooms/${code}`);
    
    // Listener para actualizar la lista de jugadores en tiempo real
    roomRef.child('players').on('value', (snapshot) => {
        const playersData = snapshot.val();
        const playerListElement = document.getElementById('player-list');
        const playerCountElement = document.getElementById('player-count');

        if (!playerListElement) return; // Si la pantalla ya fue cambiada

        let html = '';
        let count = 0;
        for (const uid in playersData) {
            count++;
            const player = playersData[uid];
            // Destaca al Host
            const isPlayerHost = uid === roomRef.hostId;
            html += `<li style="text-align: left; padding: 5px; border-bottom: 1px solid #313a5a;">
                        ${isPlayerHost ? '👑' : ''} ${player.nickname} 
                        (${uid === auth.currentUser.uid ? 'Tú' : 'Listo'})
                    </li>`;
        }
        
        playerCountElement.textContent = count;
        playerListElement.innerHTML = html;
        
        // Habilitar/Deshabilitar botón de inicio para el Host
        const btnStart = document.getElementById('btn-start-game');
        if (isHost && btnStart) {
            btnStart.disabled = (count < 4); // Mínimo 4 jugadores para iniciar
        }
    });

    // Listener para el botón de salir de sala
    document.getElementById('btn-leave-lobby').addEventListener('click', async () => {
        // Remover al jugador de la sala
        await roomRef.child(`players/${auth.currentUser.uid}`).remove();
        
        // Si el que sale es el Host, borramos toda la sala, siguiendo tu regla
        if (isHost) {
             alert("¡El Host se fue! Cerrando la partida para todos...");
             await roomRef.remove(); // Elimina la sala completa
        } else {
             alert("Has salido de la sala.");
        }
        
        // Detener todos los listeners de la sala
        roomRef.off();
        showScreen('lobby');
    });

    // Listener para el botón de INICIAR JUEGO (Solo Host)
    if (isHost) {
        document.getElementById('btn-start-game').addEventListener('click', () => {
             // Aquí iría la lógica para asignar roles, palabras y cambiar el estado de la sala a 'in_game'
             alert("¡Juego iniciado! (La lógica de asignación de roles viene después...)");
             // Por ahora, solo simula el inicio
             // **Próximo Paso: Implementar StartGameLogic(code)**
        });
    }

    // Listener para detectar que la sala ha sido eliminada por el host
    if (!isHost) {
        roomRef.on('value', (snapshot) => {
            if (!snapshot.exists() && customLobbyScreen.style.display === 'block') {
                roomRef.off(); // Detiene el listener
                alert("El Host ha cerrado la partida. Volviendo al lobby.");
                showScreen('lobby');
            }
        });
    }
}
