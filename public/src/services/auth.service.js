// src/services/auth.service.js
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification as firebaseSendEmailVerification,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  verifyPasswordResetCode as firebaseVerifyPasswordResetCode,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  onAuthStateChanged,
  reload as firebaseReload
} from "../lib/firebase/auth.js";
import { getFriendlyAuthErrorMessage } from "../utils/auth-errors.js";

/**
 * Validação de formato de e-mail simples e seguro no cliente
 */
export function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Criação de conta com e-mail e senha
 * Envia automaticamente o e-mail de verificação oficial
 */
export async function registerWithEmail(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    // Envia e-mail de verificação nativo
    await firebaseSendEmailVerification(userCredential.user);
    return userCredential.user;
  } catch (error) {
    const friendlyMessage = getFriendlyAuthErrorMessage(error.code);
    throw new Error(friendlyMessage);
  }
}

/**
 * Login com e-mail e senha
 */
export async function loginWithEmail(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    return userCredential.user;
  } catch (error) {
    const friendlyMessage = getFriendlyAuthErrorMessage(error.code);
    throw new Error(friendlyMessage);
  }
}

/**
 * Envia / Reenvia e-mail de verificação para o usuário atualmente logado
 */
export async function resendVerificationEmail() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Nenhum usuário conectado para reenviar verificação.");
  }
  try {
    await firebaseSendEmailVerification(user);
  } catch (error) {
    const friendlyMessage = getFriendlyAuthErrorMessage(error.code);
    throw new Error(friendlyMessage);
  }
}

/**
 * Recarrega dados do usuário atual a partir do Firebase Authentication
 * Atualiza propriedades como emailVerified
 */
export async function reloadCurrentUser() {
  const user = auth.currentUser;
  if (!user) return null;
  await firebaseReload(user);
  return auth.currentUser;
}

/**
 * Envia e-mail de recuperação de senha com link seguro
 */
export async function sendPasswordReset(email) {
  try {
    await firebaseSendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    // Por segurança e para evitar enumeração de contas, não expomos erro de conta inexistente
    // Porém se for erro de rede, podemos reportar
    if (error.code === "auth/network-request-failed") {
      throw new Error(getFriendlyAuthErrorMessage(error.code));
    }
    // Para outros códigos, silencia ou lança mensagem genérica sem confirmar existência
  }
}

/**
 * Verifica código de redefinição de senha (oobCode) contido no link recebido por e-mail
 */
export async function verifyResetCode(actionCode) {
  try {
    return await firebaseVerifyPasswordResetCode(auth, actionCode);
  } catch (error) {
    const friendlyMessage = getFriendlyAuthErrorMessage(error.code);
    throw new Error(friendlyMessage);
  }
}

/**
 * Confirma a nova senha utilizando o código oobCode
 */
export async function resetPasswordWithCode(actionCode, newPassword) {
  try {
    await firebaseConfirmPasswordReset(auth, actionCode, newPassword);
  } catch (error) {
    const friendlyMessage = getFriendlyAuthErrorMessage(error.code);
    throw new Error(friendlyMessage);
  }
}

/**
 * Logout centralizado da aplicação
 */
export async function logoutUser() {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("[Auth] Erro ao realizar logout:", error);
    throw new Error("Não foi possível encerrar a sessão. Tente novamente.");
  }
}

/**
 * Observador de mudanças no estado de autenticação
 */
export function subscribeToAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Retorna o usuário atual
 */
export function getCurrentUser() {
  return auth.currentUser;
}
