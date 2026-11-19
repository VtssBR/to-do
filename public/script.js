/**
 * FLOWBOARD — GERENCIADOR DE TAREFAS KANBAN
 * Implementação em JavaScript Vanilla (ES6+) com Firebase Cloud Firestore (SDK v13.4.0 via CDN)
 * 
 * Módulos e Responsabilidades:
 * 1. Gerenciamento de Estado & Conexão em Tempo Real (onSnapshot)
 * 2. Persistência Exclusiva no Cloud Firestore
 * 3. Sistema de Temas (Dark / Light Mode - UI state no localStorage)
 * 4. Renderização do Quadro Kanban & Cards
 * 5. Drag-and-Drop Nativo do HTML5 com batch writes
 * 6. Sistema de Modais (Criação/Edição e Confirmação de Exclusão)
 * 7. Filtros, Pesquisa e Ordenação
 * 8. Notificações Toast & Atalhos de Teclado
 */

'use strict';

import {
  subscribeToTasks,
  createTask,
  updateTask,
  deleteTask,
  batchUpdateTaskOrders
} from './src/services/task.service.js';

// ==========================================================================
// CONSTANTES E CHAVES DE ARMAZENAMENTO (APENAS PREFERÊNCIAS DE UI)
// ==========================================================================
const UI_STORAGE_KEYS = {
  THEME: 'flowboard_theme_v1',
  COMPACT: 'flowboard_compact_v1'
};

// ==========================================================================
// UTILITÁRIOS DE DATA (FORMATO LOCAL E RELATIVO EM PORTUGUÊS)
// ==========================================================================
function getTodayIsoString(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatRelativeDueDate(dateString) {
  if (!dateString) return '';

  const [y, m, d] = dateString.split('-').map(Number);
  const taskDate = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = taskDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { label: 'Hoje', isToday: true, isOverdue: false };
  if (diffDays === 1) return { label: 'Amanhã', isToday: false, isOverdue: false };
  if (diffDays === -1) return { label: 'Ontem', isToday: false, isOverdue: true };
  if (diffDays < -1) {
    const formatted = taskDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
    return { label: `${formatted}.`, isToday: false, isOverdue: true };
  }

  const formatted = taskDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
  return { label: `${formatted}.`, isToday: false, isOverdue: false };
}

function updateHeaderCurrentDate() {
  const dateElement = document.getElementById('current-formatted-date');
  if (!dateElement) return;

  const now = new Date();
  const weekday = now.toLocaleDateString('pt-BR', { weekday: 'long' });
  const day = now.toLocaleDateString('pt-BR', { day: 'numeric' });
  const month = now.toLocaleDateString('pt-BR', { month: 'long' });

  // Capitaliza primeira letra de cada palavra
  const formattedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const formattedMonth = month.charAt(0).toUpperCase() + month.slice(1);

  dateElement.textContent = `${formattedWeekday}, ${day} de ${formattedMonth}`;
}

// ==========================================================================
// DADOS DEMONSTRATIVOS INICIAIS (SEED DATA PARA RESTAURAR PADRÃO NO FIRESTORE)
// ==========================================================================
const DEFAULT_TASKS = [
  {
    title: 'Definir arquitetura e stack do projeto',
    description: 'Documentar os padrões de pastas, CDN do Firebase Firestore e regras de segurança.',
    dueDate: getTodayIsoString(0),
    priority: 'alta',
    category: 'Trabalho',
    status: 'done',
    order: 0
  },
  {
    title: 'Implementar listener onSnapshot em tempo real',
    description: 'Conectar a interface diretamente ao Cloud Firestore para sincronização instantânea.',
    dueDate: getTodayIsoString(1),
    priority: 'alta',
    category: 'Produto',
    status: 'in-progress',
    order: 0
  },
  {
    title: 'Refatorar formulários e modais para async/await',
    description: 'Integrar createTask e updateTask garantindo tratamento de erros e feedbacks visuais.',
    dueDate: getTodayIsoString(2),
    priority: 'media',
    category: 'Trabalho',
    status: 'todo',
    order: 0
  },
  {
    title: 'Revisar regras de segurança do Firestore',
    description: 'Configurar o arquivo firestore.rules impedindo acessos e campos corrompidos.',
    dueDate: getTodayIsoString(3),
    priority: 'alta',
    category: 'Estudos',
    status: 'todo',
    order: 1
  },
  {
    title: 'Ajustar estilo visual Cyberpunk nos novos estados',
    description: 'Validar contrastes, animações de loading, empty states e toasts de notificação.',
    dueDate: getTodayIsoString(5),
    priority: 'baixa',
    category: 'Pessoal',
    status: 'todo',
    order: 2
  }
];

// ==========================================================================
// ESTADO GLOBAL DA APLICAÇÃO
// ==========================================================================
export const AppState = {
  tasks: [],
  filters: {
    view: 'all', // 'all' | 'today' | 'upcoming' | 'done'
    project: null, // 'Trabalho' | 'Produto' | 'Pessoal' | 'Estudos' | null
    priority: 'all', // 'all' | 'alta' | 'media' | 'baixa'
    searchQuery: ''
  },
  sorting: 'manual', // 'manual' | 'date-asc' | 'date-desc' | 'priority-desc' | 'priority-asc' | 'title-asc'
  compactMode: false,
  draggedTaskId: null,
  taskPendingDeletionId: null,
  unsubscribeFirestore: null,
  loading: true,
  error: null,

  // Inicialização do Estado
  init() {
    this.initTheme();
    this.initCompactMode();
    this.migrateLocalStorageData();
    this.startFirestoreListener();
  },

  // Migração segura de dados antigos do localStorage caso existam
  async migrateLocalStorageData() {
    const OLD_STORAGE_KEY = 'flowboard_tasks_v1';
    try {
      const stored = localStorage.getItem(OLD_STORAGE_KEY);
      if (stored) {
        const localTasks = JSON.parse(stored);
        if (Array.isArray(localTasks) && localTasks.length > 0) {
          console.info(`[Migração] Migrando ${localTasks.length} tarefas do localStorage para o Firestore...`);
          for (const item of localTasks) {
            await createTask({
              title: item.title,
              description: item.description || '',
              dueDate: item.dueDate || '',
              priority: item.priority || 'media',
              category: item.category || 'Trabalho',
              status: item.status || 'todo'
            }, item.order || 0);
          }
          showToast(`${localTasks.length} tarefas locais migradas para a nuvem!`, 'success');
        }
        localStorage.removeItem(OLD_STORAGE_KEY);
      }
    } catch (err) {
      console.warn('[Migração] Falha ao migrar dados do localStorage:', err);
    }
  },

  // Inicia a sincronização em tempo real via onSnapshot
  startFirestoreListener() {
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
      this.unsubscribeFirestore = null;
    }

    this.loading = true;
    this.error = null;
    this.render();

    this.unsubscribeFirestore = subscribeToTasks(
      (updatedTasks) => {
        this.tasks = updatedTasks;
        this.loading = false;
        this.error = null;
        this.render();
      },
      (err) => {
        console.error('[Firestore] Erro no recebimento de snapshot:', err);
        this.loading = false;
        this.error = err.message || 'Erro ao sincronizar com o banco de dados.';
        this.render();
        if (err.code === 'permission-denied') {
          showToast('Permissão negada ao acessar o Firestore. Verifique as regras de segurança.', 'danger');
        } else {
          showToast('Falha na conexão com o Firestore. Verifique sua internet.', 'danger');
        }
      }
    );
  },

  async restoreDefaults() {
    try {
      showToast('Restaurando tarefas padrão no Firestore...', 'info');
      for (const t of DEFAULT_TASKS) {
        await createTask(t, t.order);
      }
      showToast('Tarefas padrão restauradas com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao restaurar tarefas padrão:', err);
      showToast('Falha ao restaurar tarefas no Firestore.', 'danger');
    }
  },

  initTheme() {
    const savedTheme = localStorage.getItem(UI_STORAGE_KEYS.THEME) || 'dark';
    this.applyTheme(savedTheme);
  },

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(UI_STORAGE_KEYS.THEME, theme);
    } catch (e) {
      console.warn(e);
    }
  },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(nextTheme);
    showToast(`Tema alterado para modo ${nextTheme === 'dark' ? 'escuro' : 'claro'}.`, 'info');
  },

  initCompactMode() {
    const isCompact = localStorage.getItem(UI_STORAGE_KEYS.COMPACT) === 'true';
    this.compactMode = isCompact;
    this.applyCompactMode(isCompact);
  },

  applyCompactMode(isCompact) {
    this.compactMode = isCompact;
    const layout = document.getElementById('app-layout');
    const toggleBtn = document.getElementById('btn-toggle-compact');
    if (layout) {
      layout.classList.toggle('compact-view', isCompact);
    }
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', isCompact);
    }
    try {
      localStorage.setItem(UI_STORAGE_KEYS.COMPACT, String(isCompact));
    } catch (e) {
      console.warn(e);
    }
  },

  toggleCompactMode() {
    this.applyCompactMode(!this.compactMode);
  },

  // Operações de CRUD com Firestore
  async addTask(taskData) {
    try {
      const columnTasks = this.tasks.filter(t => t.status === taskData.status);
      const newOrder = columnTasks.length;

      await createTask(taskData, newOrder);
      showToast('Tarefa criada com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao adicionar tarefa no Firestore:', err);
      showToast(err.code === 'permission-denied' ? 'Acesso negado para criar tarefa.' : 'Erro ao salvar tarefa no banco de dados.', 'danger');
    }
  },

  async updateTask(id, taskData) {
    try {
      await updateTask(id, taskData);
      showToast('Tarefa atualizada com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao atualizar tarefa no Firestore:', err);
      showToast(err.code === 'permission-denied' ? 'Acesso negado para atualizar tarefa.' : 'Erro ao atualizar tarefa.', 'danger');
    }
  },

  async deleteTask(id) {
    try {
      await deleteTask(id);
      showToast('Tarefa excluída permanentemente.', 'danger');
    } catch (err) {
      console.error('Erro ao excluir tarefa no Firestore:', err);
      showToast(err.code === 'permission-denied' ? 'Acesso negado para excluir tarefa.' : 'Erro ao excluir tarefa.', 'danger');
    }
  },

  async toggleTaskCompletion(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    const targetColumnTasks = this.tasks.filter(t => t.status === nextStatus && t.id !== id);
    const newOrder = targetColumnTasks.length;

    try {
      await updateTask(id, { status: nextStatus, order: newOrder });
      showToast(`Tarefa movida para "${nextStatus === 'done' ? 'Concluídas' : 'A fazer'}".`, 'info');
    } catch (err) {
      console.error('Erro ao alterar status da tarefa:', err);
      showToast('Erro ao atualizar status da tarefa.', 'danger');
    }
  },

  async moveTaskToColumn(taskId, targetStatus, targetIndex = null) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Se o status e a posição continuarem idênticos, não faz nada
    const targetTasks = this.tasks
      .filter(t => t.status === targetStatus && t.id !== taskId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (targetIndex === null || targetIndex >= targetTasks.length) {
      targetTasks.push(task);
    } else {
      targetTasks.splice(targetIndex, 0, task);
    }

    // Prepara batch updates
    const updates = targetTasks.map((t, index) => ({
      id: t.id,
      order: index,
      status: targetStatus
    }));

    try {
      await batchUpdateTaskOrders(updates);
    } catch (err) {
      console.error('Erro ao reordenar tarefas no Firestore:', err);
      showToast('Falha ao mover tarefa no banco de dados.', 'danger');
    }
  },

  // Filtros e Ordenação
  getFilteredTasks() {
    let result = [...this.tasks];

    // 1. Filtro da Sidebar (Visão Geral ou Projeto)
    if (this.filters.project) {
      result = result.filter(t => t.category === this.filters.project);
    } else if (this.filters.view === 'today') {
      const todayIso = getTodayIsoString(0);
      result = result.filter(t => t.dueDate === todayIso);
    } else if (this.filters.view === 'upcoming') {
      const todayIso = getTodayIsoString(0);
      result = result.filter(t => t.dueDate && t.dueDate > todayIso);
    } else if (this.filters.view === 'done') {
      result = result.filter(t => t.status === 'done');
    }

    // 2. Filtro de Prioridade (Header)
    if (this.filters.priority !== 'all') {
      result = result.filter(t => t.priority === this.filters.priority);
    }

    // 3. Pesquisa de Tarefas
    if (this.filters.searchQuery.trim()) {
      const query = this.filters.searchQuery.trim().toLowerCase();
      result = result.filter(t => 
        (t.title && t.title.toLowerCase().includes(query)) ||
        (t.description && t.description.toLowerCase().includes(query)) ||
        (t.category && t.category.toLowerCase().includes(query))
      );
    }

    // 4. Ordenação
    result = this.sortTasks(result);

    return result;
  },

  sortTasks(taskList) {
    const priorityWeight = { alta: 3, media: 2, baixa: 1 };

    switch (this.sorting) {
      case 'date-asc':
        return taskList.sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        });

      case 'date-desc':
        return taskList.sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return b.dueDate.localeCompare(a.dueDate);
        });

      case 'priority-desc':
        return taskList.sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));

      case 'priority-asc':
        return taskList.sort((a, b) => (priorityWeight[a.priority] || 0) - (priorityWeight[b.priority] || 0));

      case 'title-asc':
        return taskList.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));

      case 'manual':
      default:
        return taskList.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
  },

  // Atualização dos Indicadores Numéricos (Badges)
  updateBadges() {
    const todayIso = getTodayIsoString(0);

    const countAll = this.tasks.length;
    const countToday = this.tasks.filter(t => t.dueDate === todayIso).length;
    const countUpcoming = this.tasks.filter(t => t.dueDate && t.dueDate > todayIso).length;
    const countDone = this.tasks.filter(t => t.status === 'done').length;

    const countTrabalho = this.tasks.filter(t => t.category === 'Trabalho').length;
    const countProduto = this.tasks.filter(t => t.category === 'Produto').length;
    const countPessoal = this.tasks.filter(t => t.category === 'Pessoal').length;
    const countEstudos = this.tasks.filter(t => t.category === 'Estudos').length;

    const countColTodo = this.tasks.filter(t => t.status === 'todo').length;
    const countColInProgress = this.tasks.filter(t => t.status === 'in-progress').length;
    const countColDone = this.tasks.filter(t => t.status === 'done').length;

    const setBadge = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setBadge('count-all', countAll);
    setBadge('count-today', countToday);
    setBadge('count-upcoming', countUpcoming);
    setBadge('count-done', countDone);

    setBadge('count-trabalho', countTrabalho);
    setBadge('count-produto', countProduto);
    setBadge('count-pessoal', countPessoal);
    setBadge('count-estudos', countEstudos);

    setBadge('count-column-todo', countColTodo);
    setBadge('count-column-in-progress', countColInProgress);
    setBadge('count-column-done', countColDone);
  },

  // Renderização Geral
  render() {
    const columns = {
      todo: document.getElementById('cards-list-todo'),
      'in-progress': document.getElementById('cards-list-in-progress'),
      done: document.getElementById('cards-list-done')
    };

    // Estado de Loading
    if (this.loading) {
      Object.keys(columns).forEach(status => {
        const container = columns[status];
        if (!container) return;
        container.innerHTML = `
          <div class="column-empty-placeholder loading-placeholder">
            <span>Sincronizando tarefas com Firestore...</span>
          </div>
        `;
      });
      return;
    }

    // Estado de Erro
    if (this.error) {
      Object.keys(columns).forEach(status => {
        const container = columns[status];
        if (!container) return;
        container.innerHTML = `
          <div class="column-empty-placeholder error-placeholder">
            <span>Erro na sincronização: ${escapeHtml(this.error)}</span>
          </div>
        `;
      });
      return;
    }

    const filteredTasks = this.getFilteredTasks();

    Object.keys(columns).forEach(status => {
      const container = columns[status];
      if (!container) return;

      container.innerHTML = '';
      const columnTasks = filteredTasks.filter(t => t.status === status);

      if (columnTasks.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'column-empty-placeholder';
        emptyEl.innerHTML = `<span>Nenhuma tarefa aqui</span>`;
        container.appendChild(emptyEl);
      } else {
        columnTasks.forEach(task => {
          container.appendChild(createCardElement(task));
        });
      }
    });

    this.updateBadges();
  }
};

// ==========================================================================
// RENDERIZAÇÃO DO COMPONENTE CARD (TRELLO / LINEAR INSPIRED)
// ==========================================================================
function createCardElement(task) {
  const card = document.createElement('article');
  card.className = `kanban-card ${task.status === 'done' ? 'is-done' : ''}`;
  card.setAttribute('draggable', 'true');
  card.setAttribute('data-id', task.id);
  card.setAttribute('aria-label', `Tarefa: ${task.title}`);

  // Dot color por projeto
  const dotClassMap = {
    Trabalho: 'dot-trabalho',
    Produto: 'dot-produto',
    Pessoal: 'dot-pessoal',
    Estudos: 'dot-estudos'
  };
  const dotClass = dotClassMap[task.category] || 'dot-trabalho';

  // Informações de data
  const dateInfo = formatRelativeDueDate(task.dueDate);
  let dateHtml = '';
  if (dateInfo) {
    const dateClass = dateInfo.isOverdue ? 'is-overdue' : (dateInfo.isToday ? 'is-today' : '');
    dateHtml = `
      <span class="card-due-date ${dateClass}" title="Vencimento: ${task.dueDate}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span>${dateInfo.label}</span>
      </span>
    `;
  }

  // Descrição resumida
  const descriptionHtml = task.description 
    ? `<p class="card-description-text">${escapeHtml(task.description)}</p>` 
    : '';

  card.innerHTML = `
    <!-- Top Row: Categoria & Ações Rápidas -->
    <div class="card-header-row">
      <div class="card-category-tag">
        <span class="project-dot ${dotClass}" aria-hidden="true"></span>
        <span>${escapeHtml(task.category)}</span>
      </div>
      <div class="card-actions-group">
        <button class="card-action-btn btn-edit-card" title="Editar tarefa" aria-label="Editar tarefa">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        </button>
        <button class="card-action-btn btn-delete-card" title="Excluir tarefa" aria-label="Excluir tarefa">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- Main Row: Checkbox Circular e Título -->
    <div class="card-main-row">
      <button class="card-completion-circle ${task.status === 'done' ? 'checked' : ''}" title="${task.status === 'done' ? 'Marcar como não concluída' : 'Marcar como concluída'}" aria-label="Alterar status de conclusão">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </button>
      <h3 class="card-title-text">${escapeHtml(task.title)}</h3>
    </div>

    <!-- Descrição (se houver) -->
    ${descriptionHtml}

    <!-- Bottom Row: Badge de Prioridade e Data -->
    <div class="card-footer-row">
      <span class="card-priority-badge priority-${task.priority}">
        ${task.priority}
      </span>
      ${dateHtml}
    </div>
  `;

  // Event Listeners no Card
  const editBtn = card.querySelector('.btn-edit-card');
  const deleteBtn = card.querySelector('.btn-delete-card');
  const circleBtn = card.querySelector('.card-completion-circle');

  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    TaskModal.openEdit(task.id);
  });

  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    DeleteModal.open(task.id);
  });

  circleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    AppState.toggleTaskCompletion(task.id);
  });

  // Drag and Drop Listeners no Card
  card.addEventListener('dragstart', handleDragStart);
  card.addEventListener('dragend', handleDragEnd);

  return card;
}

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ==========================================================================
// 5. SISTEMA DE MODAIS (EXATAMENTE DOIS TIPOS DE MODAL)
// ==========================================================================

/**
 * 5.1. MODAL ÚNICO DE CRIAÇÃO E EDIÇÃO DE TAREFAS
 */
export const TaskModal = {
  backdrop: null,
  form: null,
  titleEl: null,
  subtitleEl: null,
  submitLabel: null,
  idInput: null,
  titleInput: null,
  descInput: null,
  dueDateInput: null,
  priorityInput: null,
  categoryInput: null,
  statusInput: null,
  titleError: null,

  init() {
    this.backdrop = document.getElementById('task-modal');
    this.form = document.getElementById('task-form');
    this.titleEl = document.getElementById('task-modal-title');
    this.subtitleEl = document.getElementById('task-modal-subtitle');
    this.submitLabel = document.getElementById('task-submit-label');

    this.idInput = document.getElementById('task-form-id');
    this.titleInput = document.getElementById('task-form-title');
    this.descInput = document.getElementById('task-form-description');
    this.dueDateInput = document.getElementById('task-form-duedate');
    this.priorityInput = document.getElementById('task-form-priority');
    this.categoryInput = document.getElementById('task-form-category');
    this.statusInput = document.getElementById('task-form-status');
    this.titleError = document.getElementById('title-error-msg');

    const closeBtn = document.getElementById('task-modal-close');
    const cancelBtn = document.getElementById('task-modal-cancel');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());

    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });

    this.titleInput.addEventListener('input', () => {
      if (this.titleInput.value.trim()) {
        this.titleInput.classList.remove('input-error');
        this.titleError.hidden = true;
      }
    });

    this.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });
  },

  openNew(defaultStatus = 'todo') {
    this.clearValidation();
    this.form.reset();

    this.idInput.value = '';
    this.statusInput.value = defaultStatus;
    this.priorityInput.value = 'media';
    this.categoryInput.value = AppState.filters.project || 'Trabalho';
    this.dueDateInput.value = getTodayIsoString(0);

    this.titleEl.textContent = 'Nova tarefa';
    this.subtitleEl.textContent = 'Preencha os detalhes para organizar suas atividades.';
    this.submitLabel.textContent = 'Criar tarefa';

    this.show();
    setTimeout(() => this.titleInput.focus(), 80);
  },

  openEdit(taskId) {
    const task = AppState.tasks.find(t => t.id === taskId);
    if (!task) return;

    this.clearValidation();
    this.idInput.value = task.id;
    this.titleInput.value = task.title;
    this.descInput.value = task.description || '';
    this.dueDateInput.value = task.dueDate || '';
    this.priorityInput.value = task.priority;
    this.categoryInput.value = task.category;
    this.statusInput.value = task.status;

    this.titleEl.textContent = 'Editar tarefa';
    this.subtitleEl.textContent = 'Modifique as informações desejadas da atividade.';
    this.submitLabel.textContent = 'Salvar alterações';

    this.show();
    setTimeout(() => this.titleInput.focus(), 80);
  },

  show() {
    this.backdrop.hidden = false;
    requestAnimationFrame(() => {
      this.backdrop.classList.add('is-open');
    });
  },

  close() {
    this.backdrop.classList.remove('is-open');
    setTimeout(() => {
      this.backdrop.hidden = true;
      this.clearValidation();
      this.form.reset();
    }, 200);
  },

  clearValidation() {
    this.titleInput.classList.remove('input-error');
    this.titleError.hidden = true;
  },

  async handleSubmit() {
    const title = this.titleInput.value.trim();
    if (!title) {
      this.titleInput.classList.add('input-error');
      this.titleError.hidden = false;
      this.titleInput.focus();
      return;
    }

    const taskData = {
      title,
      description: this.descInput.value,
      dueDate: this.dueDateInput.value,
      priority: this.priorityInput.value,
      category: this.categoryInput.value,
      status: this.statusInput.value
    };

    const isEdit = Boolean(this.idInput.value);
    const originalSubmitLabel = this.submitLabel.textContent;
    this.submitLabel.textContent = isEdit ? 'Salvando...' : 'Criando...';

    try {
      if (isEdit) {
        await AppState.updateTask(this.idInput.value, taskData);
      } else {
        await AppState.addTask(taskData);
      }
      this.close();
    } finally {
      this.submitLabel.textContent = originalSubmitLabel;
    }
  }
};

/**
 * 5.2. MODAL EXCLUSIVO DE CONFIRMAÇÃO DE EXCLUSÃO
 */
export const DeleteModal = {
  backdrop: null,
  confirmBtn: null,
  cancelBtn: null,
  previewTitle: null,
  previewProject: null,
  currentTaskId: null,

  init() {
    this.backdrop = document.getElementById('delete-modal');
    this.confirmBtn = document.getElementById('delete-modal-confirm');
    this.cancelBtn = document.getElementById('delete-modal-cancel');
    this.previewTitle = document.getElementById('delete-preview-title');
    this.previewProject = document.getElementById('delete-preview-project');

    this.cancelBtn.addEventListener('click', () => this.close());
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });

    this.confirmBtn.addEventListener('click', async () => {
      if (this.currentTaskId) {
        const idToDelete = this.currentTaskId;
        this.confirmBtn.disabled = true;
        this.confirmBtn.textContent = 'Excluindo...';
        try {
          await AppState.deleteTask(idToDelete);
          this.close();
        } finally {
          this.confirmBtn.disabled = false;
          this.confirmBtn.textContent = 'Excluir tarefa';
        }
      }
    });
  },

  open(taskId) {
    const task = AppState.tasks.find(t => t.id === taskId);
    if (!task) return;

    this.currentTaskId = taskId;
    this.previewTitle.textContent = task.title;
    this.previewProject.textContent = task.category;

    this.backdrop.hidden = false;
    requestAnimationFrame(() => {
      this.backdrop.classList.add('is-open');
    });
    setTimeout(() => this.cancelBtn.focus(), 80);
  },

  close() {
    this.backdrop.classList.remove('is-open');
    setTimeout(() => {
      this.backdrop.hidden = true;
      this.currentTaskId = null;
    }, 200);
  }
};

// ==========================================================================
// DRAG AND DROP NATIVO DO HTML5
// ==========================================================================
function handleDragStart(e) {
  const card = e.currentTarget;
  AppState.draggedTaskId = card.getAttribute('data-id');
  card.classList.add('is-dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', AppState.draggedTaskId);
}

function handleDragEnd(e) {
  e.currentTarget.classList.remove('is-dragging');
  AppState.draggedTaskId = null;

  document.querySelectorAll('.kanban-column').forEach(col => {
    col.classList.remove('drag-over');
  });
}

function setupDragAndDrop() {
  const columns = document.querySelectorAll('.kanban-column');

  columns.forEach(column => {
    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      column.classList.add('drag-over');
    });

    column.addEventListener('dragleave', (e) => {
      if (!column.contains(e.relatedTarget)) {
        column.classList.remove('drag-over');
      }
    });

    column.addEventListener('drop', (e) => {
      e.preventDefault();
      column.classList.remove('drag-over');

      const taskId = AppState.draggedTaskId || e.dataTransfer.getData('text/plain');
      if (!taskId) return;

      const targetStatus = column.getAttribute('data-status');
      const cardsList = column.querySelector('.kanban-cards-list');
      const siblingCards = [...cardsList.querySelectorAll('.kanban-card:not(.is-dragging)')];

      // Determina o índice de inserção baseado no cursor Y
      let insertIndex = siblingCards.length;
      for (let i = 0; i < siblingCards.length; i++) {
        const rect = siblingCards[i].getBoundingClientRect();
        const middleY = rect.top + rect.height / 2;
        if (e.clientY < middleY) {
          insertIndex = i;
          break;
        }
      }

      AppState.moveTaskToColumn(taskId, targetStatus, insertIndex);
    });
  });
}

// ==========================================================================
// NOTIFICAÇÕES TOAST
// ==========================================================================
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';

  const iconMap = {
    success: `
      <svg class="toast-icon-success" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    `,
    danger: `
      <svg class="toast-icon-danger" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    `,
    info: `
      <svg class="toast-icon-info" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    `
  };

  toast.innerHTML = `
    ${iconMap[type] || iconMap.info}
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 3200);
}

// ==========================================================================
// CONFIGURAÇÃO DE EVENTOS DE INTERFACE
// ==========================================================================
function setupUIEvents() {
  // 1. Botões de Nova Tarefa
  const sidebarNewTaskBtn = document.getElementById('sidebar-new-task-btn');
  const headerNewTaskBtn = document.getElementById('header-new-task-btn');

  if (sidebarNewTaskBtn) sidebarNewTaskBtn.addEventListener('click', () => TaskModal.openNew());
  if (headerNewTaskBtn) headerNewTaskBtn.addEventListener('click', () => TaskModal.openNew());

  // Botões de adição nas colunas
  document.querySelectorAll('[data-column-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const colStatus = btn.getAttribute('data-column-add');
      TaskModal.openNew(colStatus);
    });
  });

  // 2. Navegação da Sidebar (Filtros de Visão e Projetos)
  const navButtons = document.querySelectorAll('.nav-item');
  const pageTitle = document.getElementById('page-current-title');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterType = btn.getAttribute('data-filter-type');
      const filterValue = btn.getAttribute('data-filter-value');
      const label = btn.querySelector('.nav-item-label').textContent;

      if (filterType === 'project') {
        AppState.filters.project = filterValue;
        AppState.filters.view = 'all';
      } else {
        AppState.filters.project = null;
        AppState.filters.view = filterValue;
      }

      if (pageTitle) pageTitle.textContent = label;

      AppState.render();
      closeMobileSidebar();
    });
  });

  // 3. Filtros Rápidos de Prioridade (Header)
  const priorityPills = document.querySelectorAll('[data-priority-filter]');
  priorityPills.forEach(pill => {
    pill.addEventListener('click', () => {
      priorityPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      AppState.filters.priority = pill.getAttribute('data-priority-filter');
      AppState.render();
    });
  });

  // 4. Campo de Pesquisa em Tempo Real
  const searchInput = document.getElementById('task-search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      AppState.filters.searchQuery = val;
      if (searchClearBtn) {
        searchClearBtn.hidden = !val.trim();
      }
      AppState.render();
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchClearBtn.hidden = true;
      AppState.filters.searchQuery = '';
      AppState.render();
      searchInput.focus();
    });
  }

  // 5. Seletor de Ordenação
  const sortSelect = document.getElementById('task-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      AppState.sorting = e.target.value;
      AppState.render();
    });
  }

  // 6. Botão de Alternância de Tema (Sun / Moon)
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => AppState.toggleTheme());
  }

  // 7. Alternador de Modo Compacto
  const compactToggleBtn = document.getElementById('btn-toggle-compact');
  if (compactToggleBtn) {
    compactToggleBtn.addEventListener('click', () => AppState.toggleCompactMode());
  }

  // 8. Botão Restaurar Padrão
  const restoreBtn = document.getElementById('btn-restore-defaults');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', async () => {
      if (confirm('Deseja realmente adicionar as tarefas padrão de demonstração no Cloud Firestore?')) {
        await AppState.restoreDefaults();
      }
    });
  }

  // 9. Drawer Mobile (Sidebar)
  const mobileToggleBtn = document.getElementById('mobile-sidebar-toggle');
  const mobileCloseBtn = document.getElementById('mobile-sidebar-close');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const appSidebar = document.getElementById('app-sidebar');

  function openMobileSidebar() {
    if (appSidebar) appSidebar.classList.add('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
  }

  function closeMobileSidebar() {
    if (appSidebar) appSidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
  }

  if (mobileToggleBtn) mobileToggleBtn.addEventListener('click', openMobileSidebar);
  if (mobileCloseBtn) mobileCloseBtn.addEventListener('click', closeMobileSidebar);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileSidebar);

  // 10. Atalhos de Teclado
  document.addEventListener('keydown', (e) => {
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

    // ESC para fechar qualquer modal ou drawer
    if (e.key === 'Escape') {
      TaskModal.close();
      DeleteModal.close();
      closeMobileSidebar();
      if (document.activeElement === searchInput) {
        searchInput.blur();
      }
      return;
    }

    if (isTyping) return;

    // Tecla 'N' para Nova Tarefa
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      TaskModal.openNew();
    }

    // Tecla '/' para focar na pesquisa
    if (e.key === '/') {
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
  });
}

// ==========================================================================
// INICIALIZAÇÃO DA APLICAÇÃO AO CARREGAR O DOM
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  updateHeaderCurrentDate();
  AppState.init();
  TaskModal.init();
  DeleteModal.init();
  setupDragAndDrop();
  setupUIEvents();
});
