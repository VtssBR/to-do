// src/utils/auth-errors.js

/**
 * Mapeamento e tradução de códigos de erro do Firebase Auth para mensagens amigáveis em português.
 * Evita expor códigos técnicos, mensagens internas ou permitir enumeração de contas.
 */
export function getFriendlyAuthErrorMessage(errorCode) {
  if (!errorCode) {
    return "Não foi possível concluir a operação. Tente novamente.";
  }

  // Remove prefixos se existirem
  const code = typeof errorCode === "string" ? errorCode.replace(/^auth\//, "") : "";

  switch (code) {
    // Erros de credenciais e login
    case "invalid-credential":
    case "wrong-password":
    case "user-not-found":
    case "invalid-email":
      return "E-mail ou senha inválidos.";

    case "user-disabled":
      return "Esta conta de usuário foi desativada. Entre em contato com o suporte.";

    // Erros de cadastro
    case "email-already-in-use":
      return "Não foi possível concluir o cadastro com este e-mail. Verifique os dados ou tente fazer login.";

    case "weak-password":
      return "A senha deve ter no mínimo 8 caracteres e incluir uma combinação segura.";

    // Limites de requisição
    case "too-many-requests":
      return "Muitas tentativas consecutivas. Aguarde alguns minutos antes de tentar novamente.";

    // Erros de verificação e redefinição de link
    case "invalid-action-code":
      return "O link utilizado é inválido ou já expirou. Por favor, solicite um novo.";

    case "expired-action-code":
      return "O link expirou. Por favor, solicite um novo link.";

    // Erros de rede e sistema
    case "network-request-failed":
      return "Falha de conexão com a rede. Verifique sua internet e tente novamente.";

    case "operation-not-allowed":
      return "Método de autenticação não habilitado. Entre em contato com o administrador.";

    case "requires-recent-login":
      return "Por motivos de segurança, faça login novamente para concluir esta ação.";

    default:
      return "Não foi possível concluir a operação. Tente novamente.";
  }
}
