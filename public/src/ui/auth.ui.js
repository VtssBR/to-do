// src/ui/auth.ui.js
import {
  registerWithEmail,
  loginWithEmail,
  resendVerificationEmail,
  sendPasswordReset,
  verifyResetCode,
  resetPasswordWithCode,
  logoutUser,
  isValidEmail
} from "../services/auth.service.js";
import { authStore, AUTH_STATUS } from "../services/auth.state.js";

/**
 * Módulo de Gerenciamento de Interface e Roteamento Visual de Autenticação
 */
class AuthUIController {
  constructor() {
    this.currentView = "login"; // 'login' | 'register' | 'forgot' | 'reset' | 'verify'
    this.resetActionCode = null;
    this.resendCooldownSeconds = 0;
    this.resendTimer = null;
    this.toastCallback = null;
  }

  setToastHandler(callback) {
    this.toastCallback = callback;
  }

  showToast(message, type = "info") {
    if (this.toastCallback) {
      this.toastCallback(message, type);
    } else {
      console.log(`[Toast ${type}] ${message}`);
    }
  }

  init() {
    // Detecta se a URL contém ação de redefinição de senha do Firebase (ex: ?mode=resetPassword&oobCode=...)
    this.detectUrlAction();

    // Cria os elementos do container de autenticação no DOM
    this.createAuthOverlay();

    // Inscreve-se nas alterações de estado de autenticação
    authStore.subscribe((state) => {
      this.handleAuthStateChange(state);
    });
  }

  detectUrlAction() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get("mode");
    const oobCode = urlParams.get("oobCode");

    if (mode === "resetPassword" && oobCode) {
      this.resetActionCode = oobCode;
      this.currentView = "reset";
    }
  }

  createAuthOverlay() {
    let overlay = document.getElementById("auth-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "auth-overlay";
      overlay.className = "auth-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      document.body.appendChild(overlay);
    }
    this.overlayElement = overlay;
  }

  handleAuthStateChange(state) {
    const appLayout = document.getElementById("app-layout");

    // Durante inicialização, esconde ou previne flashes incorretos
    if (state.status === AUTH_STATUS.INITIALIZING) {
      if (appLayout) appLayout.style.visibility = "hidden";
      this.overlayElement.style.display = "flex";
      this.renderInitializing();
      return;
    }

    if (state.status === AUTH_STATUS.AUTHENTICATED) {
      // Usuário autenticado e com e-mail confirmado: libera quadro Kanban
      this.overlayElement.style.display = "none";
      if (appLayout) {
        appLayout.style.visibility = "visible";
      }
      this.updateSidebarUserProfile(state.user);
    } else if (state.status === AUTH_STATUS.AWAITING_VERIFICATION) {
      // Usuário logado mas e-mail não confirmado: bloqueia Kanban e mostra verificação
      if (appLayout) appLayout.style.visibility = "hidden";
      this.overlayElement.style.display = "flex";
      this.currentView = "verify";
      this.renderVerificationView(state.user);
    } else {
      // UNAUTHENTICATED: Usuário sem sessão
      if (appLayout) appLayout.style.visibility = "hidden";
      this.overlayElement.style.display = "flex";
      if (this.currentView === "verify") {
        this.currentView = "login";
      }
      this.renderCurrentView();
    }
  }

  renderInitializing() {
    this.overlayElement.innerHTML = `
      <div class="auth-card" style="text-align: center; padding: 40px 20px;">
        <div class="auth-logo-badge" style="margin: 0 auto 16px;">
          <span class="btn-spinner" style="width: 24px; height: 24px; margin: 0; border-width: 3px;"></span>
        </div>
        <h2 class="auth-title">Carregando FlowBoard...</h2>
        <p class="auth-subtitle">Verificando sessão de usuário...</p>
      </div>
    `;
  }

  renderCurrentView() {
    switch (this.currentView) {
      case "register":
        this.renderRegisterView();
        break;
      case "forgot":
        this.renderForgotPasswordView();
        break;
      case "reset":
        this.renderResetPasswordView();
        break;
      case "verify":
        const user = authStore.getState().user;
        this.renderVerificationView(user);
        break;
      case "login":
      default:
        this.renderLoginView();
        break;
    }
  }

  // =========================================================================
  // VIEW: LOGIN
  // =========================================================================
  renderLoginView() {
    this.overlayElement.innerHTML = `
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-logo-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <path d="M9 3v18" />
              <path d="M15 9h6" />
              <path d="M9 15h6" />
            </svg>
          </div>
          <h2 class="auth-title">Acessar FlowBoard</h2>
          <p class="auth-subtitle">Entre com suas credenciais para acessar suas tarefas</p>
        </div>

        <div id="auth-alert-box"></div>

        <form id="auth-login-form" novalidate>
          <div class="form-group" style="margin-bottom: 16px;">
            <label for="login-email" class="form-label">E-mail</label>
            <input
              type="email"
              id="login-email"
              class="form-control"
              placeholder="seu@email.com"
              autocomplete="email"
              required
            >
          </div>

          <div class="form-group" style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label for="login-password" class="form-label" style="margin-bottom: 0;">Senha</label>
              <button type="button" class="auth-link" id="btn-goto-forgot" style="font-size: 0.8rem;">
                Esqueceu a senha?
              </button>
            </div>
            <div class="password-input-wrapper">
              <input
                type="password"
                id="login-password"
                class="form-control"
                placeholder="Sua senha de acesso"
                autocomplete="current-password"
                required
              >
              <button type="button" class="password-toggle-btn" id="btn-toggle-login-pass" aria-label="Visualizar senha" title="Visualizar senha">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-block" id="btn-login-submit" style="height: 42px;">
            <span id="login-submit-text">Entrar</span>
          </button>
        </form>

        <div class="auth-footer-nav">
          <div>
            Não possui uma conta?
            <button type="button" class="auth-link" id="btn-goto-register">Cadastre-se</button>
          </div>
        </div>
      </div>
    `;

    this.bindLoginEvents();
  }

  bindLoginEvents() {
    const form = document.getElementById("auth-login-form");
    const emailInput = document.getElementById("login-email");
    const passInput = document.getElementById("login-password");
    const togglePassBtn = document.getElementById("btn-toggle-login-pass");
    const submitBtn = document.getElementById("btn-login-submit");
    const submitText = document.getElementById("login-submit-text");

    togglePassBtn?.addEventListener("click", () => {
      const isPassword = passInput.getAttribute("type") === "password";
      passInput.setAttribute("type", isPassword ? "text" : "password");
    });

    document.getElementById("btn-goto-register")?.addEventListener("click", () => {
      this.currentView = "register";
      this.renderRegisterView();
    });

    document.getElementById("btn-goto-forgot")?.addEventListener("click", () => {
      this.currentView = "forgot";
      this.renderForgotPasswordView();
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const password = passInput.value;

      // Validação frontend prévia
      if (!email || !isValidEmail(email)) {
        this.displayAuthAlert("Por favor, informe um endereço de e-mail válido.", "error");
        emailInput.focus();
        return;
      }

      if (!password) {
        this.displayAuthAlert("Por favor, digite sua senha de acesso.", "error");
        passInput.focus();
        return;
      }

      // Feedback visual e desabilitação durante processamento
      submitBtn.classList.add("loading");
      submitBtn.disabled = true;
      submitText.innerHTML = `<span class="btn-spinner"></span> Entrando...`;
      this.clearAuthAlert();

      try {
        const user = await loginWithEmail(email, password);
        // O listener onAuthStateChanged cuidará da transição (se verificado vai pro Kanban, se não vai pra tela de verificação)
      } catch (err) {
        this.displayAuthAlert(err.message, "error");
        submitBtn.classList.remove("loading");
        submitBtn.disabled = false;
        submitText.textContent = "Entrar";
      }
    });
  }

  // =========================================================================
  // VIEW: CADASTRO
  // =========================================================================
  renderRegisterView() {
    this.overlayElement.innerHTML = `
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-logo-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
          </div>
          <h2 class="auth-title">Criar Conta</h2>
          <p class="auth-subtitle">Cadastre-se com facilidade e gerencie suas atividades</p>
        </div>

        <div id="auth-alert-box"></div>

        <form id="auth-register-form" novalidate>
          <div class="form-group" style="margin-bottom: 14px;">
            <label for="reg-email" class="form-label">E-mail</label>
            <input
              type="email"
              id="reg-email"
              class="form-control"
              placeholder="seu@email.com"
              autocomplete="email"
              required
            >
          </div>

          <div class="form-group" style="margin-bottom: 14px;">
            <label for="reg-password" class="form-label">Senha (mínimo 8 caracteres)</label>
            <div class="password-input-wrapper">
              <input
                type="password"
                id="reg-password"
                class="form-control"
                placeholder="Crie sua senha segura"
                autocomplete="new-password"
                required
              >
              <button type="button" class="password-toggle-btn" id="btn-toggle-reg-pass" aria-label="Visualizar senha">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 20px;">
            <label for="reg-confirm-password" class="form-label">Confirmar senha</label>
            <div class="password-input-wrapper">
              <input
                type="password"
                id="reg-confirm-password"
                class="form-control"
                placeholder="Repita sua senha"
                autocomplete="new-password"
                required
              >
              <button type="button" class="password-toggle-btn" id="btn-toggle-reg-confirm-pass" aria-label="Visualizar confirmação de senha">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-block" id="btn-register-submit" style="height: 42px;">
            <span id="register-submit-text">Cadastrar</span>
          </button>
        </form>

        <div class="auth-footer-nav">
          <div>
            Já possui uma conta?
            <button type="button" class="auth-link" id="btn-goto-login">Fazer login</button>
          </div>
        </div>
      </div>
    `;

    this.bindRegisterEvents();
  }

  bindRegisterEvents() {
    const form = document.getElementById("auth-register-form");
    const emailInput = document.getElementById("reg-email");
    const passInput = document.getElementById("reg-password");
    const confirmInput = document.getElementById("reg-confirm-password");
    const togglePass = document.getElementById("btn-toggle-reg-pass");
    const toggleConfirm = document.getElementById("btn-toggle-reg-confirm-pass");
    const submitBtn = document.getElementById("btn-register-submit");
    const submitText = document.getElementById("register-submit-text");

    togglePass?.addEventListener("click", () => {
      const isPass = passInput.getAttribute("type") === "password";
      passInput.setAttribute("type", isPass ? "text" : "password");
    });

    toggleConfirm?.addEventListener("click", () => {
      const isPass = confirmInput.getAttribute("type") === "password";
      confirmInput.setAttribute("type", isPass ? "text" : "password");
    });

    document.getElementById("btn-goto-login")?.addEventListener("click", () => {
      this.currentView = "login";
      this.renderLoginView();
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const password = passInput.value;
      const confirmPassword = confirmInput.value;

      // Validação do formato de e-mail
      if (!email || !isValidEmail(email)) {
        this.displayAuthAlert("Por favor, informe um e-mail com formato válido.", "error");
        emailInput.focus();
        return;
      }

      // Validação de no mínimo 8 caracteres
      if (!password || password.length < 8) {
        this.displayAuthAlert("A senha deve ter no mínimo 8 caracteres.", "error");
        passInput.focus();
        return;
      }

      // Validação de confirmação de senha
      if (password !== confirmPassword) {
        this.displayAuthAlert("A confirmação de senha não corresponde à senha informada.", "error");
        confirmInput.focus();
        return;
      }

      // Feedback e bloqueio de múltiplos envios
      submitBtn.classList.add("loading");
      submitBtn.disabled = true;
      submitText.innerHTML = `<span class="btn-spinner"></span> Criando conta...`;
      this.clearAuthAlert();

      try {
        await registerWithEmail(email, password);
        this.showToast("Sua conta foi criada com sucesso!", "success");
        // O estado mudará para AWAITING_VERIFICATION e o listener renderizará a tela de verificação
      } catch (err) {
        this.displayAuthAlert(err.message, "error");
        submitBtn.classList.remove("loading");
        submitBtn.disabled = false;
        submitText.textContent = "Cadastrar";
      }
    });
  }

  // =========================================================================
  // VIEW: VERIFICAÇÃO DE E-MAIL
  // =========================================================================
  renderVerificationView(user) {
    const userEmail = user?.email || "seu e-mail";

    this.overlayElement.innerHTML = `
      <div class="auth-card">
        <div class="verification-card-content">
          <div class="verification-icon-box">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </div>

          <h2 class="auth-title">Verifique seu e-mail</h2>
          <p class="auth-subtitle">
            Enviamos um link de confirmação para o endereço:<br>
            <span class="verification-email-highlight">${userEmail}</span>
          </p>

          <div id="auth-alert-box">
            <div class="auth-alert auth-alert-info">
              Sua conta ainda precisa ser verificada. Acesse sua caixa de entrada e clique no link recebido para liberar o acesso.
            </div>
          </div>

          <div style="display: flex; flex-direction: column; width: 100%; gap: 10px; margin-top: 8px;">
            <button type="button" class="btn btn-primary btn-block" id="btn-check-verification">
              <span id="check-verify-text">Já confirmei meu e-mail</span>
            </button>

            <button type="button" class="btn btn-outline btn-block" id="btn-resend-verification">
              <span id="resend-text">Reenviar e-mail de verificação</span>
            </button>
          </div>

          <div class="resend-countdown" id="resend-countdown-msg"></div>

          <div class="auth-footer-nav" style="width: 100%;">
            <button type="button" class="btn-restore" id="btn-verification-logout" style="justify-content: center;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Sair da conta</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindVerificationEvents();
  }

  bindVerificationEvents() {
    const checkBtn = document.getElementById("btn-check-verification");
    const checkText = document.getElementById("check-verify-text");
    const resendBtn = document.getElementById("btn-resend-verification");
    const resendText = document.getElementById("resend-text");
    const logoutBtn = document.getElementById("btn-verification-logout");
    const countdownMsg = document.getElementById("resend-countdown-msg");

    // Verifica se já há um cooldown ativo
    if (this.resendCooldownSeconds > 0) {
      this.updateResendCooldownUi(resendBtn, countdownMsg);
    }

    // Botão "Já confirmei" -> executa reload()
    checkBtn?.addEventListener("click", async () => {
      checkBtn.classList.add("loading");
      checkBtn.disabled = true;
      checkText.innerHTML = `<span class="btn-spinner"></span> Verificando...`;

      const isVerified = await authStore.checkVerificationStatus();

      if (isVerified) {
        this.showToast("Seu e-mail foi verificado com sucesso!", "success");
        // O authStore notificará e renderizará a tela principal automaticamente
      } else {
        this.displayAuthAlert("Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada (ou spam) e clique no link.", "error");
        checkBtn.classList.remove("loading");
        checkBtn.disabled = false;
        checkText.textContent = "Já confirmei meu e-mail";
      }
    });

    // Reenviar e-mail de verificação com intervalo de segurança de 60 segundos
    resendBtn?.addEventListener("click", async () => {
      if (this.resendCooldownSeconds > 0) return;

      resendBtn.classList.add("loading");
      resendBtn.disabled = true;
      resendText.innerHTML = `<span class="btn-spinner"></span> Enviando...`;

      try {
        await resendVerificationEmail();
        this.displayAuthAlert("Enviamos um novo link de verificação para seu e-mail.", "success");
        this.showToast("Enviamos as instruções para seu e-mail.", "info");

        // Inicia cooldown de 60 segundos para evitar envios excessivos
        this.startResendCooldown(60, resendBtn, resendText, countdownMsg);
      } catch (err) {
        this.displayAuthAlert(err.message, "error");
        resendBtn.classList.remove("loading");
        resendBtn.disabled = false;
        resendText.textContent = "Reenviar e-mail de verificação";
      }
    });

    // Logout durante etapa de verificação
    logoutBtn?.addEventListener("click", async () => {
      try {
        await logoutUser();
        this.showToast("Sessão encerrada com sucesso.", "info");
      } catch (err) {
        this.displayAuthAlert(err.message, "error");
      }
    });
  }

  startResendCooldown(seconds, btn, btnText, msgElement) {
    this.resendCooldownSeconds = seconds;
    btn.disabled = true;
    btn.classList.remove("loading");

    if (this.resendTimer) clearInterval(this.resendTimer);

    const tick = () => {
      if (this.resendCooldownSeconds <= 0) {
        clearInterval(this.resendTimer);
        this.resendTimer = null;
        btn.disabled = false;
        btnText.textContent = "Reenviar e-mail de verificação";
        if (msgElement) msgElement.textContent = "";
      } else {
        btnText.textContent = `Aguarde (${this.resendCooldownSeconds}s)`;
        if (msgElement) {
          msgElement.textContent = `Você poderá solicitar outro envio em ${this.resendCooldownSeconds} segundos.`;
        }
        this.resendCooldownSeconds--;
      }
    };

    tick();
    this.resendTimer = setInterval(tick, 1000);
  }

  updateResendCooldownUi(btn, msgElement) {
    btn.disabled = true;
    const btnText = document.getElementById("resend-text");
    if (btnText) btnText.textContent = `Aguarde (${this.resendCooldownSeconds}s)`;
    if (msgElement) {
      msgElement.textContent = `Você poderá solicitar outro envio em ${this.resendCooldownSeconds} segundos.`;
    }
  }

  // =========================================================================
  // VIEW: RECUPERAÇÃO DE SENHA (SOLICITAR LINK)
  // =========================================================================
  renderForgotPasswordView() {
    this.overlayElement.innerHTML = `
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-logo-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2 class="auth-title">Recuperar Senha</h2>
          <p class="auth-subtitle">Informe o seu e-mail cadastrado para receber as instruções</p>
        </div>

        <div id="auth-alert-box"></div>

        <form id="auth-forgot-form" novalidate>
          <div class="form-group" style="margin-bottom: 20px;">
            <label for="forgot-email" class="form-label">E-mail</label>
            <input
              type="email"
              id="forgot-email"
              class="form-control"
              placeholder="seu@email.com"
              autocomplete="email"
              required
            >
          </div>

          <button type="submit" class="btn btn-primary btn-block" id="btn-forgot-submit" style="height: 42px;">
            <span id="forgot-submit-text">Enviar instruções</span>
          </button>
        </form>

        <div class="auth-footer-nav">
          <div>
            Lembrou da senha?
            <button type="button" class="auth-link" id="btn-goto-login-from-forgot">Voltar para o login</button>
          </div>
        </div>
      </div>
    `;

    this.bindForgotPasswordEvents();
  }

  bindForgotPasswordEvents() {
    const form = document.getElementById("auth-forgot-form");
    const emailInput = document.getElementById("forgot-email");
    const submitBtn = document.getElementById("btn-forgot-submit");
    const submitText = document.getElementById("forgot-submit-text");

    document.getElementById("btn-goto-login-from-forgot")?.addEventListener("click", () => {
      this.currentView = "login";
      this.renderLoginView();
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();

      if (!email || !isValidEmail(email)) {
        this.displayAuthAlert("Por favor, informe um endereço de e-mail válido.", "error");
        emailInput.focus();
        return;
      }

      submitBtn.classList.add("loading");
      submitBtn.disabled = true;
      submitText.innerHTML = `<span class="btn-spinner"></span> Enviando...`;
      this.clearAuthAlert();

      try {
        await sendPasswordReset(email);
        // Mensagem genérica exibida independentemente de o e-mail estar cadastrado
        this.displayAuthAlert("Enviamos as instruções para redefinir sua senha para o endereço informado.", "success");
        this.showToast("Enviamos as instruções para redefinir sua senha.", "info");
        submitBtn.classList.remove("loading");
        submitBtn.disabled = false;
        submitText.textContent = "Enviar instruções";
      } catch (err) {
        this.displayAuthAlert(err.message, "error");
        submitBtn.classList.remove("loading");
        submitBtn.disabled = false;
        submitText.textContent = "Enviar instruções";
      }
    });
  }

  // =========================================================================
  // VIEW: REDEFINIÇÃO DE SENHA (COM LINK / oobCode)
  // =========================================================================
  async renderResetPasswordView() {
    this.overlayElement.innerHTML = `
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-logo-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 2l-2 2m-1-1l-3 3m2 2l-3 3m-2-2l-3 3m2 2l-3 3"></path>
              <circle cx="7.5" cy="16.5" r="5.5"></circle>
            </svg>
          </div>
          <h2 class="auth-title">Nova Senha</h2>
          <p class="auth-subtitle">Defina uma nova senha para a sua conta</p>
        </div>

        <div id="auth-alert-box">
          <div class="auth-alert auth-alert-info">
            <span class="btn-spinner" style="width: 14px; height: 14px; margin-right: 6px;"></span>
            Verificando validade do link...
          </div>
        </div>

        <form id="auth-reset-form" style="display: none;" novalidate>
          <div class="form-group" style="margin-bottom: 14px;">
            <label for="reset-password" class="form-label">Nova senha (mínimo 8 caracteres)</label>
            <div class="password-input-wrapper">
              <input
                type="password"
                id="reset-password"
                class="form-control"
                placeholder="Nova senha segura"
                autocomplete="new-password"
                required
              >
              <button type="button" class="password-toggle-btn" id="btn-toggle-reset-pass" aria-label="Visualizar senha">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 20px;">
            <label for="reset-confirm-password" class="form-label">Confirmar nova senha</label>
            <div class="password-input-wrapper">
              <input
                type="password"
                id="reset-confirm-password"
                class="form-control"
                placeholder="Repita a nova senha"
                autocomplete="new-password"
                required
              >
              <button type="button" class="password-toggle-btn" id="btn-toggle-reset-confirm" aria-label="Visualizar confirmação de senha">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-block" id="btn-reset-submit" style="height: 42px;">
            <span id="reset-submit-text">Salvar nova senha</span>
          </button>
        </form>

        <div class="auth-footer-nav">
          <div>
            <button type="button" class="auth-link" id="btn-goto-login-from-reset">Voltar para o login</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btn-goto-login-from-reset")?.addEventListener("click", () => {
      // Limpa os parâmetros de busca da URL
      window.history.replaceState({}, document.title, window.location.pathname);
      this.currentView = "login";
      this.renderLoginView();
    });

    if (!this.resetActionCode) {
      this.displayAuthAlert("O link de redefinição não foi informado ou é inválido.", "error");
      return;
    }

    try {
      await verifyResetCode(this.resetActionCode);
      this.clearAuthAlert();
      const form = document.getElementById("auth-reset-form");
      if (form) form.style.display = "block";
      this.bindResetFormEvents();
    } catch (err) {
      this.displayAuthAlert(err.message, "error");
    }
  }

  bindResetFormEvents() {
    const form = document.getElementById("auth-reset-form");
    const passInput = document.getElementById("reset-password");
    const confirmInput = document.getElementById("reset-confirm-password");
    const togglePass = document.getElementById("btn-toggle-reset-pass");
    const toggleConfirm = document.getElementById("btn-toggle-reset-confirm");
    const submitBtn = document.getElementById("btn-reset-submit");
    const submitText = document.getElementById("reset-submit-text");

    togglePass?.addEventListener("click", () => {
      const isPass = passInput.getAttribute("type") === "password";
      passInput.setAttribute("type", isPass ? "text" : "password");
    });

    toggleConfirm?.addEventListener("click", () => {
      const isPass = confirmInput.getAttribute("type") === "password";
      confirmInput.setAttribute("type", isPass ? "text" : "password");
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = passInput.value;
      const confirmPassword = confirmInput.value;

      if (!password || password.length < 8) {
        this.displayAuthAlert("A nova senha deve ter no mínimo 8 caracteres.", "error");
        passInput.focus();
        return;
      }

      if (password !== confirmPassword) {
        this.displayAuthAlert("A confirmação de senha não confere com a nova senha.", "error");
        confirmInput.focus();
        return;
      }

      submitBtn.classList.add("loading");
      submitBtn.disabled = true;
      submitText.innerHTML = `<span class="btn-spinner"></span> Salvando...`;
      this.clearAuthAlert();

      try {
        await resetPasswordWithCode(this.resetActionCode, password);
        this.showToast("Sua senha foi alterada com sucesso!", "success");
        // Remove parâmetros da URL
        window.history.replaceState({}, document.title, window.location.pathname);
        this.displayAuthAlert("Sua senha foi alterada com sucesso! Você já pode entrar com sua nova senha.", "success");
        submitBtn.style.display = "none";

        setTimeout(() => {
          this.currentView = "login";
          this.renderLoginView();
        }, 2000);
      } catch (err) {
        this.displayAuthAlert(err.message, "error");
        submitBtn.classList.remove("loading");
        submitBtn.disabled = false;
        submitText.textContent = "Salvar nova senha";
      }
    });
  }

  // =========================================================================
  // AUXILIARES DE ALERTA & FEEDBACK
  // =========================================================================
  displayAuthAlert(message, type = "error") {
    const alertBox = document.getElementById("auth-alert-box");
    if (!alertBox) return;

    const alertClass = type === "success" ? "auth-alert-success" : type === "info" ? "auth-alert-info" : "auth-alert-error";
    alertBox.innerHTML = `
      <div class="auth-alert ${alertClass}">
        ${message}
      </div>
    `;
  }

  clearAuthAlert() {
    const alertBox = document.getElementById("auth-alert-box");
    if (alertBox) alertBox.innerHTML = "";
  }

  // =========================================================================
  // ATUALIZAÇÃO DO WIDGET DE USUÁRIO NA SIDEBAR
  // =========================================================================
  updateSidebarUserProfile(user) {
    let profileWidget = document.getElementById("user-profile-widget");
    const sidebarFooter = document.querySelector(".sidebar-footer");

    if (!user) {
      if (profileWidget) profileWidget.remove();
      return;
    }

    const email = user.email || "Usuário";
    const initial = email.charAt(0).toUpperCase();

    const widgetHtml = `
      <div class="user-profile-widget" id="user-profile-widget">
        <div class="user-profile-info">
          <div class="user-avatar-circle" title="${email}">${initial}</div>
          <div>
            <div class="user-email-text" title="${email}">${email}</div>
            <div class="user-badge-verified">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>Verificado</span>
            </div>
          </div>
        </div>
        <button class="btn-logout" id="btn-sidebar-logout" title="Sair da conta" aria-label="Sair da conta">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
    `;

    if (!profileWidget) {
      if (sidebarFooter) {
        sidebarFooter.insertAdjacentHTML("beforebegin", widgetHtml);
      }
    } else {
      profileWidget.outerHTML = widgetHtml;
    }

    document.getElementById("btn-sidebar-logout")?.addEventListener("click", async () => {
      try {
        await logoutUser();
        this.showToast("Sessão encerrada com sucesso.", "info");
      } catch (err) {
        this.showToast(err.message, "danger");
      }
    });
  }
}

export const authUI = new AuthUIController();
