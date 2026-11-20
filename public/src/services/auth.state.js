// src/services/auth.state.js
import { subscribeToAuthState, reloadCurrentUser } from "./auth.service.js";

/**
 * Estados possíveis de autenticação:
 * - INITIALIZING: Verificando persistência e sessão com Firebase
 * - UNAUTHENTICATED: Usuário sem sessão ativa
 * - AWAITING_VERIFICATION: Usuário logado, mas emailVerified === false
 * - AUTHENTICATED: Usuário logado com emailVerified === true
 */
export const AUTH_STATUS = {
  INITIALIZING: "INITIALIZING",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  AWAITING_VERIFICATION: "AWAITING_VERIFICATION",
  AUTHENTICATED: "AUTHENTICATED"
};

class AuthStore {
  constructor() {
    this.status = AUTH_STATUS.INITIALIZING;
    this.user = null;
    this.listeners = new Set();
    this.init();
  }

  init() {
    subscribeToAuthState(async (user) => {
      if (user) {
        this.user = user;
        if (user.emailVerified) {
          this.status = AUTH_STATUS.AUTHENTICATED;
        } else {
          this.status = AUTH_STATUS.AWAITING_VERIFICATION;
        }
      } else {
        this.user = null;
        this.status = AUTH_STATUS.UNAUTHENTICATED;
      }
      this.notify();
    });
  }

  /**
   * Força uma checagem atualizada via reload() no servidor Firebase
   */
  async checkVerificationStatus() {
    if (!this.user) return false;
    try {
      const updatedUser = await reloadCurrentUser();
      if (updatedUser) {
        this.user = updatedUser;
        if (updatedUser.emailVerified) {
          this.status = AUTH_STATUS.AUTHENTICATED;
        } else {
          this.status = AUTH_STATUS.AWAITING_VERIFICATION;
        }
        this.notify();
        return updatedUser.emailVerified;
      }
    } catch (err) {
      console.error("[AuthStore] Erro ao recarregar status do usuário:", err);
    }
    return false;
  }

  getState() {
    return {
      status: this.status,
      user: this.user,
      isAuthenticated: this.status === AUTH_STATUS.AUTHENTICATED,
      isPendingVerification: this.status === AUTH_STATUS.AWAITING_VERIFICATION,
      isInitializing: this.status === AUTH_STATUS.INITIALIZING
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    // Dispara imediatamente com o estado atual
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.error("[AuthStore] Erro em listener de auth:", err);
      }
    });
  }
}

export const authStore = new AuthStore();
