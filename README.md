# Gestao Obras

Sistema web para gestao de construcao civil.

## Tecnologias

- **React 19** + **TypeScript** - UI e tipagem
- **Vite 7** - Build tool
- **Tailwind CSS 4** - Estilizacao
- **React Router 7** - Roteamento SPA

## Estrutura do Projeto

```
src/
  components/       # Componentes reutilizaveis
    layout/         # Header, MainLayout (estrutura da pagina)
    ui/             # Componentes de interface (botoes, cards, inputs)
  pages/            # Paginas da aplicacao
    Dashboard.tsx   # Pagina inicial com resumo
    Obras.tsx       # Listagem de obras
    NotFound.tsx    # Pagina 404
  hooks/            # Custom hooks
  types/            # Tipos e interfaces TypeScript
    index.ts        # Tipo Obra e demais entidades
  utils/            # Funcoes utilitarias
    formatters.ts   # Formatacao de moeda e data (pt-BR)
  App.tsx           # Configuracao de rotas
  main.tsx          # Ponto de entrada
  index.css         # Import do Tailwind CSS
```

## Rotas

| Rota     | Pagina    | Descricao              |
|----------|-----------|------------------------|
| `/`      | Dashboard | Painel com indicadores |
| `/obras` | Obras     | Listagem de obras      |
| `*`      | NotFound  | Pagina nao encontrada  |

## Como Rodar

```bash
# Instalar dependencias
npm install

# Rodar em desenvolvimento
npm run dev

# Build para producao
npm run build

# Preview do build
npm run preview
```
