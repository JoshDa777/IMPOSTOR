// --- 1. CONFIGURACIÓN DE FIREBASE (REEMPLAZA CON TUS VALORES) ---
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

// Referencias a elementos del DOM
const authScreen = document.getElementById('auth-screen');
const setupScreen = document.getElementById('setup-screen');
const lobbyScreen = document.getElementById('game-lobby');
const btnGoogleSignIn = document.getElementById('btn-google-signin');
const btnGuardarPerfil = document.getElementById('btn-guardar-perfil');
const inputNickname = document.getElementById('input-nickname');
const inputNombreFijo = document.getElementById('input-nombre-fijo');
const nombreFijoError = document.getElementById('nombre-fijo-error');
const lobbyNickname = document.getElementById('lobby-nickname');

// --- 2. GESTIÓN DE LA AUTENTICACIÓN ---

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
        // Usuario conectado
        console.log("Usuario conectado:", user.uid);
        
        // Comprobar si el usuario ya tiene un perfil completo
        const userDocRef = db.collection('users').doc(user.uid);
        const userDoc = await userDocRef.get();

        if (userDoc.exists) {
            // El usuario ya tiene un perfil completo, ir al lobby
            showScreen('lobby');
            lobbyNickname.textContent = userDoc.data().nickname;
        } else {
            // Es el primer inicio de sesión, pedir Nickname y Nombre Fijo
            showScreen('setup');
        }

    } else {
        // Usuario desconectado
        showScreen('auth');
    }
});

// Función para cambiar de pantalla
function showScreen(screen) {
    authScreen.style.display = 'none';
    setupScreen.style.display = 'none';
    lobbyScreen.style.display = 'none';
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
    }
}

// --- 3. GESTIÓN DE PERFIL (Primer Acceso y Unicidad) ---

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
    const nombreFijo = inputNombreFijo.value.trim().toLowerCase(); // Guardamos en minúsculas para unicidad

    btnGuardarPerfil.disabled = true; // Deshabilitar para prevenir doble clic
    nombreFijoError.style.display = 'none';
    nombreFijoError.textContent = '';

    if (nombreFijo.includes(' ') || nombreFijo.length < 3) {
        nombreFijoError.textContent = "El Nombre Fijo no puede tener espacios y debe tener al menos 3 caracteres.";
        nombreFijoError.style.display = 'block';
        btnGuardarPerfil.disabled = false;
        return;
    }

    try {
        // Usamos una transacción para asegurar que tanto el Nombre Fijo como el perfil se creen atómicamente.
        await db.runTransaction(async (transaction) => {
            const nombreFijoDocRef = db.collection('nombres_fijos_registrados').doc(nombreFijo);
            const nombreFijoDoc = await transaction.get(nombreFijoDocRef);

            // 1. Verificación de unicidad
            if (nombreFijoDoc.exists) {
                // El nombre fijo ya existe, lanzamos un error que la transacción capturará.
                throw new Error("Nombre Fijo ya en uso.");
            }

            // 2. Si es único, registramos el Nombre Fijo para este UID
            transaction.set(nombreFijoDocRef, { uid: user.uid });

            // 3. Creamos el perfil completo del usuario
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

        // Si la transacción fue exitosa:
        alert("¡Perfil creado exitosamente! Bienvenido.");
        showScreen('lobby');
        lobbyNickname.textContent = nickname;

    } catch (error) {
        console.error("Error en la creación del perfil:", error);
        
        // Manejar el error de unicidad que lanzamos
        if (error.message === "Nombre Fijo ya en uso.") {
            nombreFijoError.textContent = "Ese Nombre Fijo ya está registrado. Intenta con otro.";
        } else {
            nombreFijoError.textContent = "Ocurrió un error al guardar. Intenta de nuevo.";
        }
        nombreFijoError.style.display = 'block';
        btnGuardarPerfil.disabled = false; // Re-habilitar
    }
});
