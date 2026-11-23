// =========================================================
// MEMORIA PROPIA · scroll interactivo
// - Scroll suave con inercia (rueda del mouse)
// - Secciones que se quedan fijas mientras la animación avanza
// - Un tramo que se recorre de lado ("Cómo funciona")
// - Movimiento que reacciona a la velocidad del scroll
// =========================================================

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const limitar = (v) => Math.min(1, Math.max(0, v));
const suavizar = (t) => 1 - Math.pow(1 - t, 3);

document.documentElement.classList.add("js");

// Textos que escribe el script, en español (index.html) y en ruso (index-ru.html)
const TEXTOS = {
  es: {
    seguir: "Sección terminada · <b>desliza otra vez</b> para seguir",
    irA: "Ir a",
    humanoSi: (quien) => `Activa · ${quien} · respuesta en 3 a 5 días`,
    humanoNo: "Desactivada · decides solo"
  },
  ru: {
    seguir: "Раздел пройден · <b>прокрутите ещё раз</b>, чтобы продолжить",
    irA: "Перейти к разделу",
    humanoSi: (quien) => `Включена · ${quien} · ответ через 3–5 дней`,
    humanoNo: "Выключена · вы решаете сами"
  }
};
const T = TEXTOS[document.documentElement.lang.startsWith("ru") ? "ru" : "es"];

// Al recargar, la página empieza arriba para ver las animaciones desde el inicio
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
if (!location.hash) window.scrollTo(0, 0);

// Progreso de una sección fija: 0 al llegar arriba, 1 cuando termina su recorrido
function progresoFijo(seccion) {
  const r = seccion.getBoundingClientRect();
  const recorrido = r.height - window.innerHeight;
  return recorrido > 0 ? limitar(-r.top / recorrido) : (r.top <= 0 ? 1 : 0);
}

// ---------- 1. Scroll suave con inercia ----------
// La rueda no salta: la página se desliza hasta su destino.
let objetivoY = window.scrollY;
let actualY = window.scrollY;
let deslizando = false;
const usarSuave = !reducir && window.matchMedia("(pointer: fine)").matches;

function maxScroll() {
  return document.documentElement.scrollHeight - window.innerHeight;
}

function pasoSuave() {
  actualY += (objetivoY - actualY) * 0.1;
  if (Math.abs(objetivoY - actualY) < 0.5) {
    actualY = objetivoY;
    deslizando = false;
  }
  window.scrollTo(0, actualY);
  if (deslizando) requestAnimationFrame(pasoSuave);
}

function deslizarA(y) {
  objetivoY = Math.max(0, Math.min(maxScroll(), y));
  if (!usarSuave) {
    window.scrollTo({ top: objetivoY, behavior: reducir ? "auto" : "smooth" });
    return;
  }
  if (!deslizando) {
    deslizando = true;
    actualY = window.scrollY;
    requestAnimationFrame(pasoSuave);
  }
}

// ---------- 1b. Paradas: cada sección se detiene al terminar ----------
// Al llegar al final de una sección el scroll se frena. Para pasar a la
// siguiente hay que soltar la rueda y deslizar otra vez: así nadie se
// salta una sección sin haberla terminado.
let paradas = [];
const liberadas = new Set();
let enParada = null;
let llegada = 0;
let ultimaRueda = 0;
const control = document.querySelector(".control");
const avisoSeguir = document.querySelector("#avisoSeguir");

function calcularParadas() {
  const secs = [...document.querySelectorAll("main > section")];
  paradas = secs.slice(0, -1).map((s) => Math.round(s.offsetTop + s.offsetHeight - window.innerHeight));
}

function mostrarAviso(si) {
  control.classList.toggle("esperando", si);
  avisoSeguir.innerHTML = si ? T.seguir : "";
}

if (usarSuave) {
  window.addEventListener("wheel", (e) => {
    if (e.ctrlKey) return; // zoom del navegador
    e.preventDefault();

    const ahora = performance.now();
    const gestoNuevo = ahora - ultimaRueda > 250; // la inercia del trackpad no cuenta
    ultimaRueda = ahora;

    const factor = e.deltaMode === 1 ? 40 : 1;
    const delta = e.deltaY * factor;
    const base = deslizando ? objetivoY : window.scrollY;
    let destino = base + delta;

    if (delta > 0) {
      for (const p of paradas) {
        if (liberadas.has(p)) continue;
        // a) va a pasar la parada: se detiene justo ahí
        if (base < p - 2 && destino > p) {
          destino = p;
          if (enParada !== p) { enParada = p; llegada = Infinity; } // aún no ha llegado
          mostrarAviso(true);
          break;
        }
        // b) ya está detenido: solo sigue con un gesto nuevo y tras una pausa
        if (Math.abs(base - p) <= 2) {
          if (enParada !== p) { enParada = p; llegada = ahora; mostrarAviso(true); }
          if (gestoNuevo && ahora - llegada > 450) {
            liberadas.add(p);
            enParada = null;
            mostrarAviso(false);
          } else {
            destino = p;
          }
          break;
        }
      }
    }
    deslizarA(destino);
  }, { passive: false });

  window.addEventListener("resize", calcularParadas);
  window.addEventListener("load", calcularParadas);
  calcularParadas();
}

// Si el scroll viene del teclado o la barra, el destino se sincroniza
window.addEventListener("scroll", () => {
  if (!deslizando) objetivoY = actualY = window.scrollY;
  // al volver hacia arriba, las paradas se vuelven a activar
  liberadas.forEach((p) => { if (window.scrollY < p - window.innerHeight * 0.5) liberadas.delete(p); });
  if (enParada !== null) {
    const y = window.scrollY;
    // la pausa empieza a contar cuando la página realmente llega a la parada
    if (llegada === Infinity && Math.abs(y - enParada) <= 2) llegada = performance.now();
    // si pasó la parada (con las flechas o el índice) o volvió bastante arriba, se apaga
    if (y > enParada + 6 || y < enParada - window.innerHeight * 0.4) {
      enParada = null;
      mostrarAviso(false);
    }
  }
}, { passive: true });

// Enlaces internos (#como, #inicio…) se deslizan en vez de saltar
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const destino = document.querySelector(a.getAttribute("href"));
    if (!destino) return;
    e.preventDefault();
    deslizarA(destino.offsetTop);
  });
});

// ---------- 2. Secciones, índice lateral y control inferior ----------
const secciones = $$("main > section");
const indice = $("#indice");
const barra = $("#barraProgreso");
const btnAnterior = $("#anterior");
const btnSiguiente = $("#siguiente");

indice.innerHTML = secciones.map((s, i) => `
  <button data-i="${i}" aria-label="${T.irA} ${s.dataset.nombre}">
    <span class="indice__nombre">${s.dataset.nombre}</span>
    <span class="indice__raya"></span>
  </button>`).join("");
const botonesIndice = $$(".indice button");

botonesIndice.forEach((b) => {
  b.addEventListener("click", () => deslizarA(secciones[Number(b.dataset.i)].offsetTop));
});

let seccionActual = -1;

function cualSeccion() {
  const linea = window.innerHeight * 0.4;
  let actual = 0;
  secciones.forEach((s, i) => {
    if (s.getBoundingClientRect().top <= linea) actual = i;
  });
  return actual;
}

btnAnterior.addEventListener("click", () => {
  const i = cualSeccion();
  // si estás a mitad de una sección, primero vuelve a su inicio
  const inicio = secciones[i].offsetTop;
  deslizarA(window.scrollY > inicio + 10 ? inicio : secciones[Math.max(0, i - 1)].offsetTop);
});

btnSiguiente.addEventListener("click", () => {
  const i = cualSeccion();
  deslizarA(secciones[Math.min(secciones.length - 1, i + 1)].offsetTop);
});

function actualizarNavegacion() {
  const i = cualSeccion();
  barra.style.setProperty("--progreso", limitar(window.scrollY / maxScroll()));
  if (i === seccionActual) return;
  seccionActual = i;
  botonesIndice.forEach((b, j) => b.classList.toggle("activo", j === i));
  btnAnterior.disabled = i === 0 && window.scrollY < 10;
  btnSiguiente.disabled = i === secciones.length - 1;
}

// ---------- 3. Preparar las animaciones ----------
const portada = $("#inicio");

// En celular (pantallas angostas) algunas partes cambian de comportamiento
const consultaCelular = window.matchMedia("(max-width: 680px)");
const esCelular = () => consultaCelular.matches;

// La foto de la portada empieza justo debajo de la frase, mida lo que mida
function calcularTope() {
  const frase = $(".portada__frase");
  portada.style.setProperty("--tope", `${Math.round(frase.offsetTop + frase.offsetHeight + 20)}px`);
}
calcularTope();
window.addEventListener("resize", calcularTope);
document.fonts && document.fonts.ready.then(calcularTope);
const escenario = $$("#escenario li");
const header = $(".header");

const idea = $("#idea");
// cada línea del titular guarda su lado y su orden para la animación (CSS)
$$(".gigante__linea").forEach((l, i) => {
  l.style.setProperty("--lado", l.dataset.lado);
  l.style.setProperty("--i", i);
});

const como = $("#como");
const comoPista = $("#comoPista");
const pasos = $$(".paso");
const comoBarra = $("#comoBarra").parentElement;

const demoTarjeta = $("#demoTarjeta");

const porque = $("#por-que");
const textoLlenar = $("#textoLlenar");
textoLlenar.innerHTML = textoLlenar.textContent.trim().split(/\s+/)
  .map((p) => `<span class="palabra">${p}</span>`).join(" ");
const palabras = $$("#textoLlenar .palabra");

const fuller = $("#fuller");
const cartas = $$(".fuller__tarjeta");

const cierre = $("#cierre");
const reveladores = $$("[data-anim]");

// Títulos cuyas palabras entran desde los lados (como "El pasado ya no se cuenta")
const titulosDeslizar = $$("[data-deslizar]").map((t) => ({
  el: t,
  lineas: [...t.querySelectorAll(".desliza")]
}));

// ---------- 3b. Animaciones que corren solas (no dependen del scroll) ----------
// Cuando "La idea" o "Por qué" ocupan la pantalla, su animación se reproduce
// sola. Si sales por completo de la sección y vuelves, se repite.
let temporizadorPalabras = null;

function encenderPalabras() {
  clearInterval(temporizadorPalabras);
  let n = 0;
  temporizadorPalabras = setInterval(() => {
    n++;
    palabras.forEach((p, i) => {
      p.classList.toggle("encendida", i < n);
      p.classList.toggle("ultima", i === n - 1 && n < palabras.length);
    });
    if (n >= palabras.length) clearInterval(temporizadorPalabras);
  }, reducir ? 0 : 85);
}

function apagarPalabras() {
  clearInterval(temporizadorPalabras);
  palabras.forEach((p) => p.classList.remove("encendida", "ultima"));
}

function animacionesSolas(alto) {
  [idea, porque].forEach((seccion) => {
    const r = seccion.getBoundingClientRect();
    const dentro = r.top < alto * 0.55 && r.bottom > alto * 0.45;
    const fuera = r.bottom < 0 || r.top > alto;

    if (dentro && !seccion.classList.contains("animada")) {
      seccion.classList.add("animada");
      if (seccion === porque) encenderPalabras();
    } else if (fuera && seccion.classList.contains("animada")) {
      seccion.classList.remove("animada");
      if (seccion === porque) apagarPalabras();
    }
  });
}

// ---------- 4. El cuadro de animación ----------
let ultimoY = window.scrollY;
let velocidad = 0;

function animar() {
  const alto = window.innerHeight;
  const ancho = window.innerWidth;

  // Velocidad del scroll: inclina un poco las imágenes
  velocidad += ((window.scrollY - ultimoY) - velocidad) * 0.2;
  ultimoY = window.scrollY;
  const inclinacion = Math.max(-2.5, Math.min(2.5, velocidad * 0.04));
  document.documentElement.style.setProperty("--vel", `${inclinacion.toFixed(2)}deg`);

  // a) PORTADA: la foto crece y las predicciones aparecen una a una
  const pP = progresoFijo(portada);
  const e = suavizar(limitar(pP / 0.32));
  portada.style.setProperty("--e", e.toFixed(4));
  portada.style.setProperty("--v", limitar((pP - 0.18) / 0.2).toFixed(3));
  escenario.forEach((li) => li.classList.toggle("activo", pP >= Number(li.dataset.en)));
  const rPortada = portada.getBoundingClientRect();
  header.classList.toggle("header--claro", e > 0.55 && rPortada.bottom > 80);

  // b) LA IDEA y POR QUÉ se animan solas al aparecer (ver "animacionesSolas")
  animacionesSolas(alto);

  // c) CÓMO FUNCIONA
  // En computador el scroll vertical mueve los pasos de lado (con una pausa
  // al inicio y al final). En celular los pasos se deslizan con el dedo y la
  // barra solo muestra cuánto has avanzado.
  let pC;
  if (esCelular()) {
    comoPista.style.transform = "";
    const maxLado = comoPista.scrollWidth - comoPista.clientWidth;
    pC = maxLado > 0 ? limitar(comoPista.scrollLeft / maxLado) : 0;
  } else {
    pC = limitar((progresoFijo(como) - 0.08) / 0.84);
    const recorrido = comoPista.scrollWidth - ancho;
    comoPista.style.transform = `translateX(${(-pC * recorrido).toFixed(1)}px)`;
  }
  comoBarra.style.setProperty("--p", pC.toFixed(4));
  const centro = ancho / 2;
  pasos.forEach((paso) => {
    const r = paso.getBoundingClientRect();
    paso.classList.toggle("activo", r.left < centro + r.width * 0.3 && r.right > centro - r.width * 0.3);
  });

  // d) PRUÉBALO: el comparador llega inclinado y se endereza
  const rD = demoTarjeta.getBoundingClientRect();
  const pD = suavizar(limitar((alto - rD.top) / (alto * 0.75)));
  demoTarjeta.style.setProperty("--rx", `${((1 - pD) * 26).toFixed(2)}deg`);
  demoTarjeta.style.setProperty("--sc", (0.86 + pD * 0.14).toFixed(4));

  // f) FULLER: las tarjetas empiezan apiladas y se reparten
  // (en celular se deslizan de lado y no necesitan esta animación)
  const pF = esCelular() ? 1 : suavizar(limitar((progresoFijo(fuller) - 0.08) / 0.6));
  const giros = [-8, 3, 10];
  const ancho1 = cartas[0].offsetWidth;
  cartas.forEach((c, i) => {
    const destino = (i - 1) * ancho1 * 1.06;
    const x = destino * pF;
    const y = (1 - pF) * (i * 18);
    const giro = giros[i] * (1 - pF);
    c.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${giro.toFixed(2)}deg)`;
    c.style.zIndex = i === 1 ? 3 : 2 - i;
  });

  // g) Fondo oscuro al llegar al cierre (cambia el color del índice)
  document.body.classList.toggle("oscuro", cierre.getBoundingClientRect().top < alto * 0.5);

  // h) Títulos: cada línea entra desde su lado mientras el título sube
  titulosDeslizar.forEach(({ el, lineas }) => {
    const r = el.getBoundingClientRect();
    const p = limitar((alto - r.top) / (alto * 0.55));
    lineas.forEach((l, i) => {
      const q = suavizar(limitar((p - i * 0.12) / 0.75));
      const lado = Number(l.dataset.lado);
      l.style.transform = `translateX(${(lado * (1 - q) * 40).toFixed(2)}vw)`;
      l.style.opacity = (0.1 + 0.9 * q).toFixed(3);
    });
  });

  // i) Bloques que aparecen al entrar en pantalla
  reveladores.forEach((el) => {
    if (!el.classList.contains("visible") && el.getBoundingClientRect().top < alto * 0.9) {
      el.classList.add("visible");
    }
  });

  actualizarNavegacion();
}

// Bucle continuo: así la cinta del cierre siempre se mueve
let cintaX = 0;
const cinta = $("#cinta");

function bucle() {
  animar();
  if (!reducir) {
    cintaX -= 0.6 + Math.abs(velocidad) * 0.35;
    const mitad = cinta.scrollWidth / 2;
    if (-cintaX >= mitad) cintaX += mitad;
    cinta.style.transform = `translateX(${cintaX.toFixed(1)}px)`;
  }
  requestAnimationFrame(bucle);
}

requestAnimationFrame(bucle);
// la portada entra apenas carga la página
setTimeout(() => $(".portada__frase").classList.add("visible"), 100);

// ---------- 5. Modo IA ----------
const botonIA = $("#modoIA");
botonIA.addEventListener("click", () => {
  const activo = document.body.classList.toggle("modo-ia");
  botonIA.setAttribute("aria-pressed", String(activo));
});

// ---------- 6. Comparador ----------
const visor = $("#visor");
$("#deslizador").addEventListener("input", (e) => {
  visor.style.setProperty("--pos", e.target.value + "%");
});

// ---------- 7. Nivel de intervención de la IA (regla 1–100 %) ----------
const nivel = $("#nivel");
const escala = $("#escala");
const nivelValor = $("#nivelValor");
const nivelNombre = $("#nivelNombre");
const rotuloNivel = $("#rotuloNivel");
const versionesIA = $$("#versionesIA img"); // restaurar, completar, reinterpretar, reconstruir
const zonas = $$("#niveles li");
const conUmbral = $$(".visor .marcador[data-desde], .cambios li[data-desde]");

function aplicarNivel() {
  const n = Number(nivel.value);
  nivelValor.textContent = n;
  rotuloNivel.textContent = n;
  escala.style.setProperty("--n", `${((n - 1) / 99) * 100}%`);

  // Funde las 4 versiones IA: 1 % = restaurada, 100 % = reconstruida
  const posicion = ((n - 1) / 99) * (versionesIA.length - 1);
  const base = Math.floor(posicion);
  const mezcla = posicion - base;
  versionesIA.forEach((img, i) => {
    img.style.opacity = i === base ? 1 : i === base + 1 ? mezcla : 0;
  });

  let actual = zonas[0];
  zonas.forEach((li) => { if (n >= Number(li.dataset.desde)) actual = li; });
  zonas.forEach((li) => {
    li.classList.toggle("alcanzado", n >= Number(li.dataset.desde) && li !== actual);
    li.classList.toggle("actual", li === actual);
  });
  nivelNombre.textContent = actual.querySelector("b").textContent;

  conUmbral.forEach((el) => el.classList.toggle("apagado", n < Number(el.dataset.desde)));
}

nivel.addEventListener("input", aplicarNivel);
aplicarNivel();

// ---------- 8. Asistencia humana ----------
const botonHumano = $("#humano");
const humanoEstado = $("#humanoEstado");
const acompanantes = $$('input[name="acompanante"]');

function textoHumano() {
  const activo = botonHumano.getAttribute("aria-pressed") === "true";
  const quien = acompanantes.find((r) => r.checked).value;
  humanoEstado.textContent = activo
    ? T.humanoSi(quien)
    : T.humanoNo;
}

botonHumano.addEventListener("click", () => {
  const activo = botonHumano.getAttribute("aria-pressed") !== "true";
  botonHumano.setAttribute("aria-pressed", String(activo));
  document.body.classList.toggle("humano-activo", activo);
  textoHumano();
});

acompanantes.forEach((r) => r.addEventListener("change", textoHumano));

// ---------- 9. Decisión: el resultado se escribe letra por letra ----------
const estado = $("#estado");
const opciones = $$(".opcion");
let escribir = null;

opciones.forEach((opcion) => {
  opcion.addEventListener("click", () => {
    opciones.forEach((o) => o.classList.remove("elegida"));
    opcion.classList.add("elegida");

    const texto = opcion.dataset.decision;
    clearInterval(escribir);
    if (reducir) { estado.textContent = texto; return; }

    let i = 0;
    escribir = setInterval(() => {
      estado.textContent = texto.slice(0, ++i);
      if (i >= texto.length) clearInterval(escribir);
    }, 22);
  });
});
