# Well Clinic — Portal de Atendimento WhatsApp v2.0

## Setup Rápido (3 passos)

### 1. Instalar dependências
Abra o terminal na pasta do projeto e rode:
```
npm install
```

### 2. Configurar a chave da API Anthropic
No terminal:
```
export ANTHROPIC_API_KEY="sk-ant-sua-chave-aqui"
```
(No Windows: `set ANTHROPIC_API_KEY=sk-ant-sua-chave-aqui`)

### 3. Iniciar o servidor
```
npm start
```
Abra **http://localhost:3000** no navegador.

---

## O que mudou na v2.0

- **Opus 4.6 com Extended Thinking**: a IA pensa antes de responder, gerando sugestões mais precisas
- **Streaming**: a resposta aparece em tempo real, sem espera
- **Busca global** (Ctrl+K): encontre qualquer cenário por palavra-chave
- **Filtro na sidebar**: filtre cenários enquanto digita
- **Modo "Analisar Conversa"**: cole a thread inteira do WhatsApp e a IA identifica o próximo passo
- **Indicador de pensamento**: veja quando a IA está raciocinando
- **Histórico de consultas**: acesse as últimas sugestões geradas
- **Chave API protegida**: roda no servidor, nunca exposta no navegador

## Sem o servidor (modo offline)

O arquivo `wellclinic-whatsapp-portal.html` pode ser aberto diretamente no navegador para usar o modo "Navegar por Cenário" (busca manual). A IA só funciona com o servidor rodando.
