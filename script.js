const API_BASE_URL = "https://nowplace.onrender.com";

const el = {
  views: document.querySelectorAll(".view"),
  navCreate: document.getElementById("navCreate"),
  navFeed: document.getElementById("navFeed"),
  userName: document.getElementById("userName"),
  userMoment: document.getElementById("userMoment"),
  camera: document.getElementById("camera"),
  cameraPlaceholder: document.getElementById("cameraPlaceholder"),
  previewContainer: document.getElementById("previewContainer"),
  imgEnvironment: document.getElementById("imgEnvironment"),
  imgSelfie: document.getElementById("imgSelfie"),
  cameraControls: document.getElementById("cameraControls"),
  actionControls: document.getElementById("actionControls"),
  btnStartCam: document.getElementById("btnStartCam"),
  btnCaptureEnv: document.getElementById("btnCaptureEnv"),
  btnCaptureSelfie: document.getElementById("btnCaptureSelfie"),
  btnPublish: document.getElementById("btnPublish"),
  btnRestart: document.getElementById("btnRestart"),
  createStatus: document.getElementById("createStatus"),
  btnSearch: document.getElementById("btnSearch"),
  searchRadius: document.getElementById("searchRadius"),
  feedStatus: document.getElementById("feedStatus"),
  feedContainer: document.getElementById("feedContainer"),
  modalError: document.getElementById("modalError"),
  modalErrorText: document.getElementById("modalErrorText"),
  btnCloseModal: document.getElementById("btnCloseModal")
};

const state = {
  stream: null,
  envPhoto: null,
  selfiePhoto: null
};

let nomeSalvo = localStorage.getItem("nowplace_usuario") || "";
if (nomeSalvo) {
  el.userName.value = nomeSalvo;
}

function showError(msg) {
  el.modalErrorText.textContent = msg;
  el.modalError.classList.remove("hidden");
}

el.btnCloseModal.onclick = () => el.modalError.classList.add("hidden");

function switchView(view) {
  el.views.forEach(v => v.classList.remove("active"));
  document.getElementById(view).classList.add("active");
  el.navCreate.classList.toggle("active", view === "view-create");
  el.navFeed.classList.toggle("active", view === "view-feed");
}

el.navCreate.onclick = () => switchView("view-create");

el.navFeed.onclick = async () => {
  const usuario = el.userName.value.trim() || localStorage.getItem("nowplace_usuario");
  
  if (!usuario) {
    showError("Por favor, digite seu nome na tela de criação antes de explorar o feed.");
    switchView("view-create");
    return;
  }
  
  el.feedStatus.textContent = "Verificando permissão de acesso...";
  switchView("view-feed");
  
  try {
    const res = await fetch(`${API_BASE_URL}/api/status?usuario=${encodeURIComponent(usuario)}`);
    const data = await res.json();
    
    if (!data.podeVerFeed) {
      showError("Acesso bloqueado! Você precisa publicar um Now nas últimas 24h para ver o feed.");
      el.feedStatus.textContent = "Acesso bloqueado pela regra das 24h.";
      switchView("view-create");
      return;
    }
    
    loadFeed(usuario);
  } catch (err) {
    showError("Erro ao conectar com a API. Tente novamente.");
  }
};

async function startCamera() {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    el.camera.srcObject = state.stream;
    await el.camera.play();
    el.camera.classList.add("active");
    el.cameraPlaceholder.classList.add("hidden");
    
    el.btnStartCam.classList.add("hidden");
    el.btnCaptureEnv.classList.remove("hidden");
    el.createStatus.textContent = "Enquadre o ambiente e tire a primeira foto.";
    el.createStatus.className = "status";
  } catch (err) {
    showError("Não foi possível acessar a câmera. Verifique as permissões.");
  }
}

function captureFrame() {
  const canvas = document.createElement("canvas");
  canvas.width = 800; 
  canvas.height = Math.round(el.camera.videoHeight * (800 / el.camera.videoWidth));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(el.camera, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.5); 
}

el.btnStartCam.onclick = startCamera;

el.btnCaptureEnv.onclick = () => {
  state.envPhoto = captureFrame();
  el.imgEnvironment.src = state.envPhoto;
  
  el.btnCaptureEnv.classList.add("hidden");
  el.btnCaptureSelfie.classList.remove("hidden");
  el.createStatus.textContent = "Agora, vire a câmera para você e tire a selfie.";
};

el.btnCaptureSelfie.onclick = () => {
  state.selfiePhoto = captureFrame();
  el.imgSelfie.src = state.selfiePhoto;
  
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }
  el.camera.srcObject = null;
  el.camera.classList.remove("active");
  el.cameraPlaceholder.classList.remove("hidden");
  
  el.cameraControls.classList.add("hidden");
  el.actionControls.classList.remove("hidden");
  el.previewContainer.classList.remove("hidden");
  el.createStatus.textContent = "Fotos capturadas! Pronto para publicar.";
};

el.btnRestart.onclick = () => {
  state.envPhoto = null;
  state.selfiePhoto = null;
  el.previewContainer.classList.add("hidden");
  el.actionControls.classList.add("hidden");
  el.cameraControls.classList.remove("hidden");
  el.btnStartCam.classList.remove("hidden");
  el.btnCaptureEnv.classList.add("hidden");
  el.btnCaptureSelfie.classList.add("hidden");
  el.createStatus.textContent = "";
};

el.btnPublish.onclick = async () => {
  const usuario = el.userName.value.trim();
  const legenda = el.userMoment.value.trim();
  
  if (!usuario || !legenda) {
    showError("Por favor, preencha seu nome e o que está fazendo.");
    return;
  }
  
  el.btnPublish.disabled = true;
  el.createStatus.textContent = "Obtendo localização...";
  
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
    });
    
    const { latitude, longitude } = position.coords;
    el.createStatus.textContent = "Publicando Now...";
    
    const payload = {
      usuario: usuario,
      fotoAmbiente: state.envPhoto,
      fotoSelfie: state.selfiePhoto,
      lat: latitude,
      lng: longitude,
      legenda: legenda
    };
    
    const response = await fetch(`${API_BASE_URL}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.erro || "Erro ao publicar.");
    }
    
    localStorage.setItem("nowplace_last_post", Date.now().toString());
    localStorage.setItem("nowplace_usuario", usuario);
    
    el.createStatus.textContent = "Now publicado com sucesso!";
    el.createStatus.className = "status success";
    
    setTimeout(() => {
      el.btnRestart.click();
      el.userMoment.value = "";
      switchView("view-feed");
      loadFeed(usuario);
    }, 2000);
    
  } catch (err) {
    console.error(err);
    if (err.code === 1) {
      showError("Você precisa permitir o acesso à localização para publicar um Now. Verifique as configurações do seu navegador.");
    } else {
      showError(err.message || "Erro ao publicar. Verifique sua conexão e tente novamente.");
    }
    el.createStatus.textContent = "Falha na publicação.";
    el.createStatus.className = "status error";
  } finally {
    el.btnPublish.disabled = false;
  }
};

async function loadFeed(usuario) {
  el.feedContainer.innerHTML = "";
  el.feedStatus.textContent = "Buscando sua localização...";
  
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
    });
    
    const { latitude, longitude } = position.coords;
    const raioKm = Number(el.searchRadius.value);
    
    el.feedStatus.textContent = "Verificando acesso...";
    
    const checkUrl = `${API_BASE_URL}/api/posts?usuario=${encodeURIComponent(usuario)}&lat=${latitude}&lng=${longitude}&raioKm=${raioKm}`;
    const checkRes = await fetch(checkUrl);
    
    if (checkRes.status === 403) {
      showError("Acesso bloqueado. Publique um Now nas últimas 24h para ver o feed.");
      el.feedStatus.textContent = "";
      return;
    }
    
    el.feedStatus.textContent = "Buscando Nows próximos...";
    
    const url = `${API_BASE_URL}/api/posts?usuario=todos_os_usuarios&lat=${latitude}&lng=${longitude}&raioKm=${raioKm}`;
    const response = await fetch(url);
    
    const data = await response.json();
    const posts = data.posts || [];
    
    if (posts.length === 0) {
      el.feedStatus.textContent = "Nenhum Now encontrado neste raio nas últimas 24h.";
      return;
    }
    
    el.feedStatus.textContent = "";
    posts.forEach(post => renderNowCard(post));
    
  } catch (err) {
    if (err.code === 1) {
      showError("Acesso à localização negado. O feed precisa da sua localização para buscar Nows próximos.");
    } else {
      showError("Não foi possível buscar o feed. Verifique sua conexão.");
    }
    el.feedStatus.textContent = "";
  }
}

function renderNowCard(post) {
  const card = document.createElement("div");
  card.className = "now-card";
  
  const timeDiff = Math.floor((Date.now() - new Date(post.criadoEm).getTime()) / 60000);
  const timeStr = timeDiff < 1 ? "Agora mesmo" : (timeDiff < 60 ? `Há ${timeDiff} min` : `Há ${Math.floor(timeDiff/60)}h`);
  
  card.innerHTML = `
    <div class="now-images">
      <img src="${post.fotoAmbiente}" class="now-img main" draggable="true" id="img1-${post.id}">
      <img src="${post.fotoSelfie}" class="now-img secondary" draggable="true" id="img2-${post.id}">
      <div class="drag-hint">Arraste para trocar</div>
    </div>
    <div class="now-info">
      <div class="now-user">${post.usuario}</div>
      <div class="now-moment">${post.legenda}</div>
      <div class="now-meta">
        <span>📍 ${post.local}</span>
        <span>🕒 ${timeStr} • ${post.distanciaKm} km</span>
      </div>
    </div>
  `;
  
  const imgs = card.querySelectorAll(".now-img");
  imgs.forEach(img => {
    img.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", img.id);
    });
  });
  
  const imgContainer = card.querySelector(".now-images");
  imgContainer.addEventListener("dragover", (e) => e.preventDefault());
  imgContainer.addEventListener("drop", (e) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    const draggedImg = document.getElementById(draggedId);
    if (!draggedImg || !imgContainer.contains(draggedImg)) return;
    
    const isMain = draggedImg.classList.contains("main");
    if (isMain) return;
    
    imgs.forEach(i => {
      if (i.classList.contains("main")) {
        i.classList.remove("main");
        i.classList.add("secondary");
      } else {
        i.classList.remove("secondary");
        i.classList.add("main");
      }
    });
  });
  
  el.feedContainer.appendChild(card);
}

el.btnSearch.onclick = () => {
  const usuario = el.userName.value.trim() || localStorage.getItem("nowplace_usuario");
  if (usuario) loadFeed(usuario);
  else showError("Digite seu nome na tela de criação primeiro.");
};