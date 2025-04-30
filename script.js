let selectedCartons = [];
let occupiedCartons = new Set();
let inscriptions = [];
let total = 0;

const SUPABASE_URL = 'https://fhupnzsulpvhobkumtae.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZodXBuenN1bHB2aG9ia3VtdGFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3MDc1NTgsImV4cCI6MjA2MTI4MzU1OH0.-5rdAm5eClxOubV-7Jl1IyVrI1Qi4u1_nA3skgufxSc';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Función para establecer la fecha actual como la única opción
function setCurrentDay() {
  const today = new Date();
  const dayString = `${today.getDate()} ${today.toLocaleString('default', { month: 'long' })}`;
  
  const select = document.getElementById("day-select");
  select.innerHTML = ''; // Limpiar las opciones previas

  const option = document.createElement("option");
  option.value = dayString;
  option.textContent = dayString;

  select.appendChild(option); // Agregar la nueva opción
}
// Recupera los cartones ocupados desde la base de datos
async function fetchOccupiedCartons() {
  const { data, error } = await supabase
    .from('inscripciones')
    .select('cartons');  // Selecciona la columna "cartons" de todas las inscripciones

  if (error) {
    console.error("Error al obtener los cartones ocupados:", error.message);
    return;
  }

  // Unifica todos los cartones ocupados en un solo conjunto
  occupiedCartons = new Set(data.flatMap(inscription => inscription.cartons));

  // Luego, al generar los cartones, puedes verificar si están ocupados
  generateCartons();
}

// Al cargar la página, establece el día y recupera los cartones ocupados
window.onload = function () {
  setCurrentDay();
  fetchOccupiedCartons();
  supabase
  .channel('inscripciones-changes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'inscripciones' },
    payload => {
      console.log('Cambio detectado en inscripciones:', payload);
      fetchOccupiedCartons(); // <-- vuelve a consultar cartones ocupados
    }
  )
  .subscribe();
};


function showInscription() {
  hideAll();
  document.getElementById("inscription-window").classList.remove("hidden");
}

function showAdmin() {
  hideAll();
  document.getElementById("admin-window").classList.remove("hidden");
}

function goToCartons() {
  hideAll();
  document.getElementById("cartons-window").classList.remove("hidden");
  generateCartons();
}

function goToPayment() {
  if (selectedCartons.length === 0) {
    alert("Debes seleccionar al menos un cartón.");
    return;
  }
  hideAll();
  document.getElementById("payment-window").classList.remove("hidden");
  document.getElementById("final-amount").textContent = total;
}

function generateCartons() {
  const container = document.getElementById("cartons-container");
  container.innerHTML = "";
  for (let i = 1; i <= 3000; i++) {
    const div = document.createElement("div");
    div.className = "carton";
    div.textContent = i;
    if (occupiedCartons.has(i)) {
      div.classList.add("occupied");
    } else {
      div.onclick = () => toggleCarton(i, div);
    }
    container.appendChild(div);
  }
}

function toggleCarton(num, el) {
  if (selectedCartons.includes(num)) {
    selectedCartons = selectedCartons.filter(n => n !== num);
    el.classList.remove("selected");
    total -= 5;
  } else {
    selectedCartons.push(num);
    el.classList.add("selected");
    total += 5;
  }
  document.getElementById("total").textContent = total;
}

function hideAll() {
  document.querySelectorAll("body > div").forEach(d => d.classList.add("hidden"));
}

function checkAdmin() {
  const pass = document.getElementById("admin-pass").value;
  if (pass === "admin123") {
    document.getElementById("admin-panel").classList.remove("hidden");
    document.getElementById("sold-count").textContent = occupiedCartons.size;
    fetchClientCount();
    showProofs();
  } else {
    alert("Clave incorrecta");
  }
}

async function showProofs() {
  let proofsContainer = document.getElementById("proofs-container");
  proofsContainer.innerHTML = "<h3>Comprobantes:</h3>";

  const { data, error } = await supabase
    .from('inscripciones')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    console.error("Error al obtener inscripciones:", error.message);
    proofsContainer.innerHTML += "<p>Error cargando comprobantes.</p>";
    return;
  }
data.forEach((inscription, index) => {
    const div = document.createElement("div");
    div.style.marginBottom = "15px";
    div.innerHTML = ` 
      <p><strong>${index + 1}. ${inscription.name}</strong> - ${inscription.phone}</p>
      <img src="${inscription.proofURL}" alt="Comprobante" onclick="viewImage('${inscription.proofURL}')" />
    `;
    proofsContainer.appendChild(div);
  });
}
async function fetchClientCount() {
  const { count, error } = await supabase
    .from('inscripciones')
    .select('*', { count: 'exact', head: true });

  if (!error) {
    document.getElementById("clients-count").textContent = count;
  } else {
    console.error("Error obteniendo el conteo de clientes:", error.message);
  }
}

function resetData() {
  if (confirm("¿Seguro que deseas reiniciar los cartones?")) {
    occupiedCartons.clear();
    inscriptions = [];
    alert("Datos reiniciados.");
    hideAll();
    document.getElementById("main-container").classList.remove("hidden");
  }
}
async function saveInscription() {
  const name = document.getElementById("name").value;
  const phone = document.getElementById("phone").value;
  const ref = document.getElementById("referrer").value;
  const day = document.getElementById("day-select").value;
  const proofFile = document.getElementById("proof").files[0];

  if (!proofFile) {
    alert("Debes subir un comprobante.");
    return;
  }

  const fileName = `${Date.now()}_${proofFile.name}`;
  const { data, error } = await supabase.storage
    .from('comprobantes') // <-- nombre exacto de tu bucket
    .upload(fileName, proofFile);

  if (error) {
    alert("Error subiendo el comprobante.");
    console.error(error);
    return;
  }

  const { data: publicUrlData } = supabase.storage
    .from('comprobantes')
    .getPublicUrl(fileName);

  const proofURL = publicUrlData.publicUrl;
   // Aquí insertamos en la base de datos
  const { error: insertError } = await supabase
    .from('inscripciones')
    .insert([{
      name,
      phone,
      referrer: ref,
      day,
      cartons: selectedCartons,
      total,
      proof_url: proofURL
    }]);

  if (insertError) {
    console.error("Error al guardar en la base de datos:", insertError.message);
    alert("Hubo un problema guardando la inscripción en la base de datos: " + insertError.message);
    return;
  }

  occupiedCartons = new Set([...occupiedCartons, ...selectedCartons]);

  inscriptions.push({
    name,
    phone,
    ref,
    day,
    cartons: [...selectedCartons],
    total,
    proofURL
  });

alert("Inscripción guardada exitosamente.");
sendToWhatsApp(); // <- añadir esta línea
goHome();

}

function sendToWhatsApp() {
  const name = document.getElementById("name").value;
  const phone = document.getElementById("phone").value;
  const ref = document.getElementById("referrer").value;
  const day = document.getElementById("day-select").value;

  const msg = `*Nueva inscripción de Bingo*\n
*Nombre:* ${name}
*Teléfono:* ${phone}
*Referido por:* ${ref}
*Día:* ${day}
*Cartones:* ${selectedCartons.join(', ')}
*Total:* $${total}`;

  const encoded = encodeURIComponent(msg);
  const url = `https://wa.me/584123714136?text=${encoded}`;
  window.open(url, "_blank");
}

// Mostrar imagen grande (opcional, mejora visual)
function viewImage(url) {
  const win = window.open();
  win.document.write(`<img src="${url}" style="width:100%">`);
}

function goHome() {
  hideAll();
  document.getElementById("main-container").classList.remove("hidden");
  document.getElementById("form").reset();
  selectedCartons = [];
  total = 0;
  document.getElementById("total").textContent = total;
}
