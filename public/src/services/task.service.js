// src/services/task.service.js
import {
  db,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch
} from "../lib/firebase/firestore.js";

const COLLECTION_NAME = "tasks";
const tasksCollection = collection(db, COLLECTION_NAME);

/**
 * Validação de dados da tarefa antes de persistir
 */
function validateTaskData(taskData, isUpdate = false) {
  if (!isUpdate || taskData.title !== undefined) {
    if (!taskData.title || typeof taskData.title !== "string" || !taskData.title.trim()) {
      throw new Error("O título da atividade é obrigatório.");
    }
  }

  const validStatuses = ["todo", "in-progress", "done"];
  if (taskData.status !== undefined && !validStatuses.includes(taskData.status)) {
    throw new Error(`Status inválido: ${taskData.status}`);
  }

  const validPriorities = ["alta", "media", "baixa"];
  if (taskData.priority !== undefined && !validPriorities.includes(taskData.priority)) {
    throw new Error(`Prioridade inválida: ${taskData.priority}`);
  }

  const validCategories = ["Trabalho", "Produto", "Pessoal", "Estudos"];
  if (taskData.category !== undefined && !validCategories.includes(taskData.category)) {
    throw new Error(`Categoria inválida: ${taskData.category}`);
  }
}

/**
 * Inscreve um listener em tempo real para todas as tarefas ordenadas por order asc
 * @param {Function} onNext - Callback acionado com a lista atualizada de tarefas
 * @param {Function} onError - Callback acionado em caso de erro
 * @returns {Function} unsubscribe - Função para cancelar a inscrição
 */
export function subscribeToTasks(onNext, onError) {
  const q = query(tasksCollection, orderBy("order", "asc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const tasks = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          // Converte timestamps se necessário para exibição
          createdAt: data.createdAt ? (data.createdAt.toMillis ? data.createdAt.toMillis() : data.createdAt) : Date.now(),
          updatedAt: data.updatedAt ? (data.updatedAt.toMillis ? data.updatedAt.toMillis() : data.updatedAt) : Date.now()
        };
      });
      onNext(tasks);
    },
    (error) => {
      console.error("[Firestore] Erro no listener onSnapshot:", error);
      if (onError) onError(error);
    }
  );
}

/**
 * Cria uma nova tarefa no Firestore
 */
export async function createTask(taskData, currentOrder = 0) {
  validateTaskData(taskData);

  const docPayload = {
    title: taskData.title.trim(),
    description: taskData.description ? taskData.description.trim() : "",
    dueDate: taskData.dueDate || "",
    priority: taskData.priority || "media",
    category: taskData.category || "Trabalho",
    status: taskData.status || "todo",
    order: typeof currentOrder === "number" ? currentOrder : 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(tasksCollection, docPayload);
  return docRef.id;
}

/**
 * Atualiza uma tarefa existente
 */
export async function updateTask(taskId, taskData) {
  if (!taskId) throw new Error("ID da tarefa é obrigatório para atualização.");
  validateTaskData(taskData, true);

  const taskDocRef = doc(db, COLLECTION_NAME, taskId);
  const updatePayload = {
    ...taskData,
    updatedAt: serverTimestamp()
  };

  // Remove campos que não devem ser sobrescritos
  delete updatePayload.id;
  delete updatePayload.createdAt;

  if (updatePayload.title) updatePayload.title = updatePayload.title.trim();
  if (updatePayload.description !== undefined) {
    updatePayload.description = updatePayload.description ? updatePayload.description.trim() : "";
  }

  await updateDoc(taskDocRef, updatePayload);
}

/**
 * Exclui permanentemente uma tarefa
 */
export async function deleteTask(taskId) {
  if (!taskId) throw new Error("ID da tarefa é obrigatório para exclusão.");
  const taskDocRef = doc(db, COLLECTION_NAME, taskId);
  await deleteDoc(taskDocRef);
}

/**
 * Atualiza em lote a ordem e status de tarefas (usado após drag-and-drop)
 * @param {Array<{id: string, order: number, status?: string}>} updates 
 */
export async function batchUpdateTaskOrders(updates) {
  if (!updates || updates.length === 0) return;

  const batch = writeBatch(db);
  updates.forEach(({ id, order, status }) => {
    const taskDocRef = doc(db, COLLECTION_NAME, id);
    const data = {
      order,
      updatedAt: serverTimestamp()
    };
    if (status !== undefined) {
      data.status = status;
    }
    batch.update(taskDocRef, data);
  });

  await batch.commit();
}
