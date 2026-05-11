# PRD — Sistema de Laudos Técnicos (A. Bühler)

## Visão Geral

**Produto:** Sistema web de criação e gestão de laudos técnicos de qualidade para laboratório de couro e calçados.

**Empresa:** A. Bühler S/A Curtume

**Problema:** Laudos técnicos eram criados manualmente no Word/Excel, sem rastreabilidade, padronização ou exportação profissional.

**Solução:** Aplicação web PWA que gerencia o ciclo completo do laudo: criação com templates, preenchimento de resultados, avaliação automática e exportação em PDF profissional com suporte a múltiplos idiomas.

---

## Stack Técnica

- **Framework:** Next.js 16.2.4 (App Router, Turbopack)
- **UI:** React 19 + Tailwind CSS v4
- **Backend/DB/Auth:** Supabase (PostgreSQL + Auth + Storage)
- **Linguagem:** TypeScript (strict)
- **Deploy:** Vercel
- **PDF:** dom-to-image-more + jsPDF

---

## Design System

### Tema
- **Background principal:** `slate-950` (dark)
- **Accent:** Sky / Cyan (sky-400, cyan-400)
- **Tipografia:** Geist Sans (UI) + Geist Mono (números/códigos)

### Classes globais (globals.css)
- `glass-card` — card glassmorphism dark com borda sutil
- `button-primary` — botão sky/cyan gradiente com hover
- `button-secondary` — botão outline slate
- `input-dark` — input dark com borda slate e focus sky

### Status visual
| Status | Background | Texto |
|--------|-----------|-------|
| Aprovado | `emerald-500/15` | `emerald-300` |
| Reprovado | `rose-500/15` | `rose-300` |
| Rascunho | `slate-800/70` | `slate-300` |

---

## Banco de Dados (Supabase PostgreSQL)

### Tabela `laudos`
```sql
id UUID PRIMARY KEY
numero VARCHAR UNIQUE -- LAB-2000, LAB-2001...
criador_id UUID REFERENCES auth.users
cliente VARCHAR
artigo VARCHAR
cor VARCHAR
op VARCHAR
responsavel VARCHAR DEFAULT 'Cristiano Luis Backes'
codigo_item VARCHAR NULLABLE
ordem_compra VARCHAR NULLABLE
metragem VARCHAR NULLABLE
lotes VARCHAR NULLABLE
observacoes TEXT NULLABLE
status VARCHAR DEFAULT 'draft' -- draft | approved | rejected
idioma_pdf VARCHAR DEFAULT 'pt-BR' -- pt-BR | en-US | es-ES | fr-FR
criado_em TIMESTAMP DEFAULT now()
atualizado_em TIMESTAMP
finalizado_em TIMESTAMP NULLABLE
assinador_por VARCHAR NULLABLE
assinador_em TIMESTAMP NULLABLE
```

### Tabela `analises`
```sql
id UUID PRIMARY KEY
laudo_id UUID REFERENCES laudos ON DELETE CASCADE
nome VARCHAR
norma VARCHAR
specification VARCHAR -- ">3.5", ">=150", "=Blue"
unidade VARCHAR NULLABLE -- N, N/mm², %
tipo_foto VARCHAR DEFAULT 'none' -- required | optional | none
resultado VARCHAR NULLABLE
status_analise VARCHAR NULLABLE -- approved | rejected | null
foto_url VARCHAR NULLABLE
criado_em TIMESTAMP DEFAULT now()
atualizado_em TIMESTAMP
```

### Tabela `templates`
```sql
id UUID PRIMARY KEY
nome VARCHAR
descricao TEXT NULLABLE
cor VARCHAR DEFAULT 'blue' -- blue | green | gray
ativo BOOLEAN DEFAULT true
criado_em TIMESTAMP DEFAULT now()
atualizado_em TIMESTAMP
```

### Tabela `template_analises`
```sql
id UUID PRIMARY KEY
template_id UUID REFERENCES templates ON DELETE CASCADE
norma_id UUID REFERENCES normas NULLABLE
nome VARCHAR
specification VARCHAR
tipo_foto VARCHAR DEFAULT 'none'
ordem INT DEFAULT 0
criado_em TIMESTAMP DEFAULT now()
```

### Tabela `normas`
```sql
id UUID PRIMARY KEY
codigo VARCHAR UNIQUE -- ISO 5470-2, ASTM D6234
descricao TEXT
specification VARCHAR -- especificação padrão
unidade VARCHAR -- unidade padrão
ativo BOOLEAN DEFAULT true
criado_em TIMESTAMP DEFAULT now()
atualizado_em TIMESTAMP
```

### Tabela `users` (profiles)
```sql
id UUID REFERENCES auth.users
email VARCHAR
nome VARCHAR
empresa VARCHAR
funcao VARCHAR
foto_url VARCHAR NULLABLE
```

---

## Estrutura de Rotas (App Router)

```
app/
├── page.tsx                      # / → Dashboard principal
├── layout.tsx                    # Root layout
├── globals.css
├── laudos/
│   ├── novo/
│   │   └── page.jsx              # /laudos/novo → Criar laudo (2 passos)
│   └── [id]/
│       ├── page.tsx              # /laudos/[id] → Detalhe e edição
│       ├── imprimir/
│       │   └── page.tsx          # /laudos/[id]/imprimir → Visualização PDF
│       └── publico/
│           └── page.tsx          # /laudos/[id]/publico → Link público
└── admin/
    ├── normas/
    │   └── page.jsx              # /admin/normas → CRUD de normas
    ├── templates/
    │   ├── page.jsx              # /admin/templates → Listar templates
    │   └── [id]/edit/
    │       └── page.jsx          # /admin/templates/[id]/edit → Editar template
    └── analises/
        └── page.jsx              # /admin/analises → Catálogo de análises
```

---

## Páginas e Funcionalidades

### 1. Dashboard `/`
**Autenticação obrigatória.** Se não autenticado, renderiza o componente `LoginSupabase` no lugar do dashboard.

**Conteúdo:**
- Header com logo A. Bühler + nome do usuário + botão Logout
- 4 cards de estatísticas: Total de Laudos, Aprovados, Reprovados, Taxa de Aprovação (%)
- Filtros de busca: campo número (auto-search com debounce), select de cliente, select de status
- Botão "+ Novo Laudo" (link para `/laudos/novo`)
- Tabela de laudos com colunas: Nº, Cliente, Artigo, Data, Status, Ações
- Ações por linha: Abrir, Duplicar, Excluir (com modal de confirmação)
- Estado vazio: ilustração + CTA para criar primeiro laudo

---

### 2. Login — Componente `LoginSupabase`
Tela full-screen dark com card centralizado.

**Modos de exibição (state interno):**
- `login` — email + senha + botão Login + link para registrar + recuperar senha
- `registrar` — nome + email + senha + confirmar senha
- `recuperar` — email + botão enviar link
- `confirmar_email` — aviso de "verifique seu email"

**Auth via Supabase:**
- Email/senha nativo
- Google OAuth (botão existe, redireciona para Supabase OAuth)

**UI:**
- Background: `slate-950` com gradiente radial sky/cyan sutil
- Card: `glass-card` centralizado, logo A. Bühler no topo
- Transições suaves entre modos

---

### 3. Novo Laudo `/laudos/novo`
Formulário em **2 passos** com barra de progresso visual.

**Passo 1 — Dados do Produto:**

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Cliente | text | ✅ |
| Artigo | text | ✅ |
| Cor | text | ✅ |
| OP (Ordem de Produção) | text | ✅ |
| Responsável | text | ✅ (default: "Cristiano Luis Backes") |
| Código do Item | text | ❌ |
| Ordem de Compra | text | ❌ |
| Metragem | text | ❌ |
| Lotes | text | ❌ |
| Observações | textarea | ❌ |

**Passo 2 — Análises:**
- Carrega templates do banco (cards com nome, descrição, cor)
- Seleção de template preenche lista de análises automaticamente
- Lista editável: adicionar, remover análises antes de criar
- Cada análise: nome*, specification*, norma, tipo_foto
- Botão "+ Criar nova base de análises" → `/admin/templates`
- Botão "Criar Laudo" → chama `criarLaudo()` + `adicionarAnalise[]` → redireciona para `/laudos/[id]`

---

### 4. Detalhe do Laudo `/laudos/[id]`
Página principal de trabalho no laudo.

**Seção: Cabeçalho**
- Número do laudo (LAB-XXXXXX) em destaque
- Badge de status com cor dinâmica
- Datas: criado em, finalizado em (se houver)
- Botões: Imprimir/PDF, Link público, Voltar

**Seção: Informações do Produto**
- Exibe todos os campos do laudo (cliente, artigo, cor, op, etc.)
- Se status = `draft`: botão "Editar" que abre form inline com todos os campos
- Se finalizado: somente leitura

**Seção: Análises**

Tabela com colunas: Análise, Norma, Specification, Resultado, Unidade, Status, Ações

- Para cada análise em `draft`: campo input de resultado editável inline (salva ao sair do foco/Enter)
- Status calculado automaticamente via `avaliarStatus(resultado, specification)`
- Badge de status: ✅ Aprovado / ❌ Reprovado / — (pendente)
- Ações: Editar (modal), Excluir (confirmação)
- Botão "+ Adicionar Análise" (abre modal com form + seletor de norma)
- Upload de foto: desabilitado (estrutura pronta, comentada)

**Seção: Configuração**
- Seletor de idioma do PDF (visível apenas se `draft`): 4 botões com bandeiras — 🇧🇷 Português, 🇺🇸 English, 🇪🇸 Español, 🇫🇷 Français

**Seção: Progresso**
- Barra de progresso: percentual de análises com resultado preenchido
- Contador: "X de Y análises preenchidas"

**Seção: Resultado Final**
- Calculado por `calcularStatusGeral(analises)`:
  - Todos aprovados → "Aprovado" (emerald)
  - Algum reprovado → "Reprovado" (rose)
  - Algum pendente → "Aguardando resultados" (slate)
- Botão "Finalizar e Registrar Laudo" (visível se `draft` e todos preenchidos)
  - Modal de confirmação com status calculado
  - Chama `finalizarLaudo()` → muda status, salva idioma, registra data/assinador
  - Após finalizar: página vira somente leitura

---

### 5. Imprimir/PDF `/laudos/[id]/imprimir`
Layout A4 branco otimizado para impressão.

**Barra superior (não imprime):**
- Botão "Baixar PDF" — usa dom-to-image + jsPDF
- Botão "Imprimir" — `window.print()`
- Botão "Copiar link público"
- Botão Voltar

**Layout do documento A4:**
```
┌─────────────────────────────────────────┐
│ [Logo A.Bühler]    LAUDO TÉCNICO        │
│                    Nº LAB-XXXX  Data    │
│                    Status: APROVADO     │
├─────────────────────────────────────────┤
│ INFORMAÇÕES DO PRODUTO                  │
│ Cliente: ...    Artigo: ...             │
│ Cor: ...        OP: ...                 │
│ Responsável: ...                        │
├─────────────────────────────────────────┤
│ ANÁLISES REALIZADAS                     │
│ ┌──────────┬───────┬────────┬────────┐  │
│ │ Análise  │ Spec  │ Result │ Status │  │
│ └──────────┴───────┴────────┴────────┘  │
├─────────────────────────────────────────┤
│ REGISTRO FOTOGRÁFICO (grid 3 cols)      │
│ [foto] [foto] [foto]                    │
├─────────────────────────────────────────┤
│ OBSERVAÇÕES                             │
│ ...                                     │
├─────────────────────────────────────────┤
│ [Assinatura.png]                        │
│ Cristiano Luis Backes    Data           │
└─────────────────────────────────────────┘
```

---

### 6. Laudo Público `/laudos/[id]/publico`
Acesso **sem autenticação** (link compartilhável).

- Mesmo layout visual do `/imprimir`
- Barra inferior fixa com: Baixar PDF, Copiar link, Imprimir
- Sem opção de edição
- Header simplificado sem ações de admin

---

### 7. Admin — Normas `/admin/normas`
CRUD completo de normas/standards técnicas.

**Listagem:**
- Campo de busca (código ou descrição)
- Tabela: Código, Descrição, Specification padrão, Unidade, Ações
- Ações: Editar (form inline), Excluir (modal confirm)

**Criar norma:**
- Form em card no topo ou modal
- Campos: Código* (ex: ISO 5470-2), Descrição*, Specification, Unidade

---

### 8. Admin — Templates `/admin/templates`
Gerenciamento de templates de análises.

**Grid de cards** (2 colunas):
- Cada card: nome, descrição, badge de cor, quantidade de análises
- Cor do card: blue/green/gray (configurável)
- Ações: Editar (link), Clonar (modal nome), Excluir (modal confirm)

**Criar template:**
- Modal ou form: nome*, descrição, cor (selector visual)

---

### 9. Admin — Editor de Template `/admin/templates/[id]/edit`
Dois painéis lado a lado (ou stacked em mobile):

**Painel esquerdo — Dados do template:**
- Editar: nome, descrição, cor
- Botão Salvar

**Painel direito — Análises do template:**
- Tabela: Ordem, Nome, Norma, Specification, Tipo Foto, Ações
- Botões de reordenação ↑↓ por linha
- Ações: Editar (form inline ou modal), Excluir (confirm)
- Botão "+ Adicionar do catálogo" → modal com lista de normas para selecionar
- Botão "+ Adicionar manualmente" → form: nome*, norma (select de normas), specification, tipo_foto

---

## Lib de Serviços (`lib/laudosServiceSupabase.js`)

Todas as chamadas ao Supabase ficam centralizadas aqui. Exporta funções assíncronas:

### Auth
```js
registrar(email, senha, nome)
login(email, senha)
loginComGoogle()
logout()
recuperarSenha(email)
obterUsuarioLogado()
obterDadosUsuario(userId)
```

### Laudos
```js
criarLaudo(laudoData)           // gera número LAB-XXXXXX sequencial
getLaudo(id)
meuHistoricoLaudos(filtros)     // filtros: numero, cliente, status
atualizarLaudo(id, updateData)
finalizarLaudo(id, pdfUrl, status, idiomaPdf)
deletarLaudo(id)
duplicarLaudo(id)               // copia laudo + todas análises, status = draft
obterEstatisticas()             // retorna { total, aprovados, reprovados, taxa }
```

### Análises
```js
adicionarAnalise(laudoId, analiseData)
getAnalises(laudoId)
atualizarAnalise(id, updateData)
deletarAnalise(id)
```

### Fotos
```js
uploadFoto(laudoId, analiseId, file)   // bucket: fotos-laudos, max 5MB — DESABILITADO
deletarFoto(analiseId, fotoUrl)
```

### Normas
```js
listarNormas(filtro)
criarNorma(codigo, descricao, specification, unidade)
atualizarNorma(id, dados)
deletarNorma(id)
```

### Templates
```js
listarTemplates()
obterTemplate(id)
criarTemplate(nome, descricao, cor)
atualizarTemplate(id, nome, descricao, cor)
deletarTemplate(id)
clonarTemplate(id, novoNome)
```

### Template Análises
```js
adicionarAnaliseTemplate(templateId, nome, normaId, spec, tipoFoto)
atualizarAnaliseTemplate(id, dados)
deletarAnaliseTemplate(id)
reordenarAnaliseTemplate(analiseId, novaOrdem)
```

### Catálogo
```js
listarCatalogoAnalises()   // retorna normas disponíveis para selecionar
```

### Constantes
```js
IDIOMAS_DISPONIVEIS = [
  { codigo: 'pt-BR', label: '🇧🇷 Português', nativo: 'Português' },
  { codigo: 'en-US', label: '🇺🇸 English', nativo: 'English' },
  { codigo: 'es-ES', label: '🇪🇸 Español', nativo: 'Español' },
  { codigo: 'fr-FR', label: '🇫🇷 Français', nativo: 'Français' },
]
```

---

## Utilitários (`lib/avaliarAnalise.ts`)

```typescript
// Avalia um resultado contra uma specification
// Operators: > < >= <= =
// Retorna 'approved' | 'rejected' | null (se resultado vazio)
avaliarStatus(resultado: string, specification: string): 'approved' | 'rejected' | null

// Calcula status geral de todas análises de um laudo
// Se alguma rejected → 'rejected'
// Se todas approved → 'approved'
// Se alguma ainda null → 'draft'
calcularStatusGeral(analises: Analise[]): 'approved' | 'rejected' | 'draft'
```

---

## Hook de Auth (`lib/useAuth.ts`)

```typescript
function useAuth(requireAuth = true): { user: User | null, loading: boolean }
```

- Subscreve a mudanças de sessão Supabase
- Se `requireAuth = true` e sem sessão → redireciona para `/`
- Usado em todas as páginas protegidas

---

## Componentes

### `components/LoginSupabase.jsx`
Componente autônomo de autenticação. Renderizado pelo `app/page.tsx` quando usuário não está autenticado. Contém toda a lógica de login, registro e recuperação de senha.

### `components/LogoAbuhler.jsx`
```jsx
// Props: height (default 44), invertido (default true), className
// Renderiza /public/logo-abuhler.png
// invertido=true aplica filter: invert() para fundo escuro
```

---

## Assets Públicos

- `/public/logo-abuhler.png` — Logo da empresa A. Bühler
- `/public/assinatura-cristiano.png` — Imagem da assinatura para PDF

---

## Fluxo Core do Usuário

```
1. Acessa / → não autenticado → LoginSupabase
2. Faz login → Dashboard com lista de laudos
3. Clica "+ Novo Laudo"
4. Preenche dados do produto (Passo 1)
5. Seleciona template de análises (Passo 2)
6. Laudo criado → redireciona para /laudos/[id]
7. Preenche resultados de cada análise
8. Sistema avalia automaticamente: ✅/❌ por análise
9. Seleciona idioma do PDF
10. Clica "Finalizar e Registrar"
11. Confirma modal → status muda para approved/rejected
12. Clica "Imprimir/PDF" → /laudos/[id]/imprimir
13. Baixa PDF ou compartilha link público
```

---

## O que NÃO está implementado (backlog)

- Upload de fotos (código comentado, estrutura de banco existe)
- RLS (Row Level Security) no Supabase
- PDF com texto traduzido (idioma salvo, tradução não aplicada no layout)
- Google OAuth (botão existe, redirect pendente)
- Dashboard com gráficos
- Integração ERP / export Excel
- App mobile React Native

---

## Variáveis de Ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=<sua-url-supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<sua-anon-key>
```
