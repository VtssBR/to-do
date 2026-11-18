# FlowBoard — Gerenciador de Tarefas Kanban (Cyberpunk Edition) ⚡

Uma aplicação web moderna, intuitiva e responsiva para gerenciamento de tarefas (To-Do List) utilizando um layout de quadro Kanban com cards inspirados em ferramentas profissionais de produtividade como Trello, Linear e Todoist.

O projeto foi construído com estética visual inspirada no universo **Cyberpunk** e segue estritamente a paleta de cores oficial com efeitos de iluminação *neon glow*.

---

## 📸 Referências Visuais

Os materiais de referência do projeto encontram-se organizados em `public/assets/`:
- **`public/assets/layout.png`**: Composição de layout, organização dos elementos, colunas do Kanban, modais e hierarquia visual.
- **`public/assets/paleta.png`**: Paleta oficial de 5 cores.
- **`public/assets/cyber.png`**: Tipografia luminosa e efeitos de resplendor neon sobre fundo escuro.

---

## 🎨 Paleta de Cores Oficial

A aplicação utiliza exclusivamente as cores da paleta oficial definida para o projeto:

| Cor | Hex | Aplicação no Projeto |
| :--- | :--- | :--- |
| **Neon Pink** | `#ff2a6d` | Botão principal de ação ("Nova tarefa"), badges de prioridade Alta, ações de exclusão destrutivas, realces e checkmark de conclusão |
| **Electric Cyan** | `#05d9e8` | Foco de inputs, bordas neon ativas, títulos com glow, badges de média prioridade e acentos |
| **Ice Cyan** | `#d1f7ff` | Tipografia principal luminosa, badges de baixa prioridade e brilhos suaves |
| **Oceanic Teal** | `#005678` | Bordas estruturais, badges neutros e status "A fazer" |
| **Midnight Void** | `#01012b` | Fundo principal da aplicação e superfícies escuras |

---

## ✨ Funcionalidades

### 1. Quadro Kanban
- **3 Colunas Principais**:
  - `A fazer`: tarefas pendentes.
  - `Em andamento`: tarefas em execução.
  - `Concluídas`: tarefas finalizadas.
- **Drag-and-Drop Nativo (HTML5)**: arraste cards livremente entre as colunas ou reordene-os internamente com cálculo dinâmico de posição e feedback visual com brilho neon.
- **Checkmark Circular Rápido**: clique no círculo do card para alternar o status da tarefa diretamente para concluída/pendente.
- **Modo Compacto (`≡ Compacto`)**: botão no cabeçalho para alternar a densidade dos cards (ocultando descrições e reduzindo espaçamento interno).

### 2. Sistema de Modais (Exatamente 2 Modais)
- **Modal de Criação / Edição de Tarefas**:
  - Formulário completo: título (obrigatório, com validação visual), descrição, data de vencimento, prioridade (Alta, Média, Baixa), projeto (Trabalho, Produto, Pessoal, Estudos) e coluna/status.
  - Reutilizado dinamicamente tanto para criar quanto para editar tarefas existentes.
- **Modal de Confirmação de Exclusão**:
  - Acionado exclusivamente pelo ícone de lixeira no card.
  - Exibe ícone de alerta, preview do título e categoria da tarefa, exigindo confirmação explícita antes da exclusão.

### 3. Filtros, Busca & Ordenação
- **Navegação Lateral (Sidebar)**:
  - *Visão Geral*: Todas as tarefas, Hoje, Próximas e Concluídas.
  - *Projetos*: Trabalho, Produto, Pessoal e Estudos.
- **Filtros Rápidos no Header**: pílulas de prioridade (*Todas*, *Alta*, *Média*, *Baixa*).
- **Pesquisa em Tempo Real**: busca instantânea no título, descrição e projeto, com botão de limpar e atalho `/`.
- **Ordenação**: ordem manual (preserva a ordem do drag-and-drop), data de vencimento (crescente/decrescente), prioridade (Alta → Baixa ou Baixa → Alta) e alfabética.
- **Restaurar Padrão**: botão no rodapé da sidebar para restaurar os dados de demonstração iniciais.

### 4. Persistência & Temas
- **`localStorage`**: todas as tarefas, movimentações do Kanban, modo compacto e tema são persistidos automaticamente no navegador.
- **Dark Mode & Light Mode**: alternância instantânea com ícone no cabeçalho (tema padrão escuro Cyberpunk).

### 5. Atalhos de Teclado
- <kbd>N</kbd>: abre o modal de Nova Tarefa.
- <kbd>/</kbd>: foca no campo de busca.
- <kbd>Esc</kbd>: fecha qualquer modal aberto ou gaveta mobile.

---

## 📁 Estrutura de Pastas do Projeto

```text
to-do/
├── README.md                  # Documentação do projeto
└── public/
    ├── index.html             # Estrutura semântica e acessibilidade da aplicação
    ├── style.css              # Tokens de design, variáveis CSS, neon glow e responsividade
    ├── script.js              # Lógica de estado, CRUD, drag-and-drop e filtros (Vanilla JS)
    └── assets/
        ├── cyber.png          # Referência estética de neon e tipografia
        ├── layout.png         # Referência visual de composição e layout
        └── paleta.png         # Paleta de cores oficial do projeto
```

---

## 🚀 Como Executar o Projeto

A aplicação não utiliza frameworks, bibliotecas externas ou processos de compilação.

Para executar localmente:

1. Clone o repositório ou faça o download dos arquivos:
   ```bash
   git clone https://github.com/seu-usuario/to-do.git
   cd to-do
   ```
2. Abra o arquivo `public/index.html` diretamente no seu navegador, ou utilize qualquer servidor estático local (como a extensão Live Server do VS Code ou Python):
   ```bash
   # Exemplo via Python a partir da pasta raiz:
   python -m http.server 5500 -d public
   ```
3. Acesse `http://localhost:5500` no navegador.

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 Semântico**: marcação acessível e estruturada.
- **CSS3 Moderno**: variáveis CSS, Flexbox, Grid, gradientes neon, backdrop filters e media queries mobile-first.
- **JavaScript Vanilla (ES6+)**: manipulação pura do DOM, HTML5 Drag and Drop API e LocalStorage API.
- **Fonte Rajdhani (Google Fonts)**: nos pesos 400, 500, 600 e 700.
