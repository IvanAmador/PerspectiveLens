# Instruções para Refatoração da UI - PerspectiveLens

## Contexto do Projeto

Você está trabalhando na refatoração completa da interface do usuário da extensão Chrome PerspectiveLens. O objetivo é migrar de um sistema customizado de toasts e terminal de logs para usar a API nativa chrome.notifications, centralizar todo o CSS usando Material Design 3, e implementar modo escuro automático.

## Documentação Obrigatória

Antes de começar qualquer tarefa, leia estes documentos na ordem:

1. **DOCS/UI-REFACTORING-ANALYSIS.md** - Análise completa do estado atual
   - Estrutura de arquivos UI
   - Sistema atual de toasts e progress tracker
   - Fluxo de processamento e eventos
   - Arquivos não utilizados
   - Problemas identificados

2. **DOCS/material-3/MATERIAL-3-REFERENCE.md** - Referência Material Design 3
   - Sistema de cores light/dark
   - Tipografia
   - Design tokens
   - Componentes
   - Chrome Material 3 Expressive

3. **DOCS/UI-REFACTORING-PLAN.md** - Plano de execução detalhado
   - 10 fases de refatoração
   - Tarefas específicas com código exemplo
   - Estimativas de tempo
   - Checklist final

## Como Trabalhar

### Protocolo de Execução

1. **Sempre consultar o plano**: Abra DOCS/UI-REFACTORING-PLAN.md
2. **Identificar a fase atual**: Verifique qual fase está em andamento
3. **Ler a task específica**: Cada task tem duração, prioridade, arquivo, documentação e código
4. **Consultar documentação**: Use os links de documentação em cada task
5. **Implementar**: Siga o código exemplo fornecido
6. **Atualizar status**: Marque a task como completa no plano
7. **Commitar**: Faça commit granular após cada task significativa

### Estrutura de uma Task

Cada task no plano segue este formato:

```
### Task X.Y: Nome da Task
Duração: X horas
Prioridade: Alta/Média/Baixa

Arquivo: caminho/do/arquivo.js

Documentação:
- @DOCS/arquivo-referencia.md

Ação:
- Descrição clara do que fazer

Código:
Exemplo completo de implementação
```

### Regras Importantes

1. **Nunca pule etapas**: Siga a ordem das fases e tasks
2. **Sempre use variáveis CSS**: Nunca hardcode valores (cores, spacing, etc)
3. **Consulte design-system.css**: É a única fonte de verdade para design tokens
4. **Teste após cada fase**: Não acumule mudanças sem testar
5. **Mantenha compatibilidade**: Código antigo deve funcionar durante migração
6. **Documente mudanças**: Atualize o plano com observações

## Status Atual da Refatoração

### Fase Atual: FASE 1 - PREPARAÇÃO E SETUP

### Tasks Completadas

Nenhuma task foi completada ainda. O projeto está pronto para iniciar a refatoração.

### Próxima Task

**Task 1.1: Adicionar Permission ao Manifest**
- Arquivo: manifest.json
- Duração: 5 minutos
- Ação: Adicionar "notifications" às permissions

### Checklist de Progresso por Fase

**FASE 1: PREPARAÇÃO E SETUP**
- [ ] Task 1.1: Adicionar permission ao manifest
- [ ] Task 1.2: Criar estrutura de pastas
- [ ] Task 1.3: Backup de arquivos antigos

**FASE 2: NOTIFICATION MANAGER**
- [ ] Task 2.1: Criar NotificationManager
- [ ] Task 2.2: Criar Event Listeners
- [ ] Task 2.3: Integrar com Logger

**FASE 3: INTEGRAÇÃO COM BACKGROUND.JS**
- [ ] Task 3.1: Substituir calls de toast
- [ ] Task 3.2: Remover progress tracker

**FASE 4: CENTRALIZAÇÃO DE CSS**
- [ ] Task 4.1: Auditar design-system.css
- [ ] Task 4.2: Refatorar popup.css
- [ ] Task 4.3: Refatorar ui/options.css
- [ ] Task 4.4: Refatorar ui/analysis-panel.css
- [ ] Task 4.5: Refatorar ui/panel/panel-styles.css
- [ ] Task 4.6: Refatorar ui/settings-modal.css

**FASE 5: AUTO DARK MODE**
- [ ] Task 5.1: Criar dark mode script
- [ ] Task 5.2: Adicionar a páginas HTML

**FASE 6: CHROME MATERIAL 3 EXPRESSIVE**
- [ ] Task 6.1: Segmented progress indicator
- [ ] Task 6.2: Icon buttons com background

**FASE 7: FLAGS E ÍCONES**
- [ ] Task 7.1: Flag icon system
- [ ] Task 7.2: Integrar flags nas notificações
- [ ] Task 7.3: Chrome UI icons

**FASE 8: LIMPEZA E OTIMIZAÇÃO**
- [ ] Task 8.1: Deletar arquivos antigos
- [ ] Task 8.2: Atualizar manifest
- [ ] Task 8.3: Verificar imports
- [ ] Task 8.4: Limpar código comentado

**FASE 9: TESTES E POLIMENTO**
- [ ] Task 9.1: Testes funcionais
- [ ] Task 9.2: Testes de performance
- [ ] Task 9.3: Polimento visual

**FASE 10: DOCUMENTAÇÃO**
- [ ] Task 10.1: Atualizar README
- [ ] Task 10.2: Changelog
- [ ] Task 10.3: Criar guia de contribuição

## Arquivos Principais do Projeto

### Arquivos de Documentação

```
DOCS/
├── UI-REFACTORING-ANALYSIS.md      # Análise completa do estado atual
├── UI-REFACTORING-PLAN.md          # Plano detalhado de execução
├── material-3/
│   └── MATERIAL-3-REFERENCE.md     # Referência Material Design 3
└── chrome-apis/
    └── chrome.notifications         # Documentação da API
```

### Arquivos UI Atuais (a serem modificados)

```
ui/
├── design-system.css               # Única fonte de design tokens
├── toast-notification.js           # A SER REMOVIDO
├── toast-notification.css          # A SER REMOVIDO
├── progress-tracker.js             # A SER REMOVIDO
├── progress-tracker.css            # A SER REMOVIDO
├── panel-loader.js                 # Manter, pode precisar ajustes
├── analysis-panel.js               # Verificar se é legacy
├── analysis-panel-v2.js            # Versão atual
├── analysis-panel.html             # Refatorar CSS
├── analysis-panel.css              # Refatorar: usar tokens
├── settings-modal.html             # Refatorar CSS
├── settings-modal.css              # Refatorar: usar tokens
├── settings-modal.js               # Pode precisar ajustes
├── options.css                     # Refatorar: usar tokens
├── options.js                      # Pode precisar ajustes
├── icons.js                        # Manter
└── panel/
    ├── panel-styles.css            # Refatorar: usar tokens
    ├── panel-renderer.js           # Manter
    └── stages/
        ├── stage1-renderer.js      # Manter
        ├── stage2-renderer.js      # Manter
        ├── stage3-renderer.js      # Manter
        └── stage4-renderer.js      # Manter
```

### Arquivos UI Novos (a serem criados)

```
ui/
├── theme-manager.js                # Auto dark mode
├── flags.js                        # Flag icon system
└── notifications/
    ├── notificationManager.js      # Wrapper chrome.notifications
    └── notificationListeners.js    # Event listeners
```

### Arquivos Core (precisam integração)

```
scripts/
├── background.js                   # Integrar notificationManager
└── content.js                      # Remover toast/progress refs

utils/
└── logger.js                       # Integrar com notifications

manifest.json                       # Atualizar permissions e resources
popup.html                          # Adicionar theme-manager
popup.css                           # Refatorar: usar tokens
options.html                        # Adicionar theme-manager
```

## Comandos Úteis

### Criar estruturas

```bash
# Fase 1, Task 1.2
mkdir -p ui/notifications

# Fase 1, Task 1.3
mkdir -p DOCS/deprecated
mv ui/toast-notification.* DOCS/deprecated/
mv ui/progress-tracker.* DOCS/deprecated/
```

### Deletar arquivos antigos (Fase 8)

```bash
# Apenas após migração completa e testada
rm ui/toast-notification.js
rm ui/toast-notification.css
rm ui/progress-tracker.js
rm ui/progress-tracker.css
```

## Padrões de Código

### CSS: Sempre usar variáveis

```css
/* ERRADO - Não fazer */
.button {
  background: #1A73E8;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 16px;
}

/* CORRETO - Sempre fazer */
.button {
  background: var(--md-sys-color-primary);
  border-radius: var(--md-button-shape);
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-lg);
}
```

### JavaScript: Usar NotificationManager

```javascript
// ERRADO - Código antigo
window.PerspectiveLensToast.showSuccess('Title', 'Message');

// CORRETO - Código novo
await notificationManager.showSuccess('Title', 'Message');
```

### Imports

```javascript
// Em background.js
import { notificationManager } from '../ui/notifications/notificationManager.js';

// Em qualquer arquivo que precisa flags
import { getFlagEmoji, getFlagElement } from '../ui/flags.js';
```

## Testes Obrigatórios

Após completar cada fase, execute estes testes:

### Testes Funcionais Mínimos

1. **Carregar extensão**: chrome://extensions
2. **Abrir popup**: Deve carregar sem erros
3. **Abrir options**: Deve carregar sem erros
4. **Iniciar análise**: Em um artigo de notícia
5. **Verificar notificações**: Devem aparecer corretamente
6. **Verificar dark mode**: Mudar preferência do sistema

### Verificação de Console

Abra DevTools (F12) e verifique:
- Nenhum erro vermelho no console
- Warnings esperados apenas (se houver)
- Logs do logger.js funcionando

### Verificação Visual

- Cores corretas em light mode
- Cores corretas em dark mode
- Botões com estilo Material 3
- Spacing consistente
- Animações smooth

## Como Atualizar Este Documento

Quando completar uma task:

1. Marque com [x] no checklist de progresso
2. Atualize "Tasks Completadas" com resumo
3. Atualize "Próxima Task" com a seguinte
4. Adicione observações em "Notas de Implementação" se necessário

### Formato de Atualização

```markdown
### Tasks Completadas

**FASE 1**
- [x] Task 1.1: Permission adicionada ao manifest.json
- [x] Task 1.2: Pasta ui/notifications/ criada
- [x] Task 1.3: Arquivos movidos para DOCS/deprecated/

Observação: Task 1.3 - Arquivos apenas movidos, não deletados ainda.

### Próxima Task

**Task 2.1: Criar NotificationManager**
- Arquivo: ui/notifications/notificationManager.js
- Duração: 2-3 horas
- Consultar: DOCS/UI-REFACTORING-PLAN.md linha 150-250
```

## Notas de Implementação

### Decisões Importantes

Nenhuma decisão tomada ainda. Use esta seção para documentar:
- Mudanças no plano original
- Problemas encontrados e soluções
- Otimizações implementadas
- Breaking changes

### Problemas Conhecidos

Nenhum problema conhecido no momento.

### Observações

- O arquivo ui/design-system.css já está bem estruturado com tokens Material 3
- Flags já existem em icons/flags/*.svg
- Chrome UI icons já existem em DOCS/chrome-ui/icons/*.svg
- Logger.js já tem estrutura para USER/SYSTEM context logs

## Links Úteis

### Chrome APIs
- chrome.notifications: https://developer.chrome.com/docs/extensions/reference/api/notifications
- chrome.tabs: https://developer.chrome.com/docs/extensions/reference/api/tabs
- Manifest V3: https://developer.chrome.com/docs/extensions/mv3/

### Material Design 3
- Homepage: https://m3.material.io/
- Components: https://m3.material.io/components/
- Web: https://material-web.dev/
- Color system: https://m3.material.io/styles/color/system

### Ferramentas
- Material Theme Builder: https://m3.material.io/theme-builder
- Google Fonts Icons: https://fonts.google.com/icons

## Workflow Recomendado

### Iniciar uma Nova Sessão

1. Ler CLAUDE.md (este arquivo)
2. Verificar "Status Atual" e "Próxima Task"
3. Abrir DOCS/UI-REFACTORING-PLAN.md na task específica
4. Consultar documentação referenciada
5. Implementar
6. Testar
7. Atualizar CLAUDE.md
8. Commit

### Fazer Commit

Use mensagens descritivas seguindo conventional commits:

```bash
# Exemplos
git commit -m "feat(notifications): implement NotificationManager class"
git commit -m "refactor(css): centralize popup.css using design tokens"
git commit -m "chore(manifest): add notifications permission"
git commit -m "docs(claude): update progress after phase 1"
```

### Branches

Trabalhe em uma branch específica:

```bash
git checkout -b feature/ui-refactoring
# ... fazer mudanças ...
git add .
git commit -m "feat: complete phase 1 setup"
git push origin feature/ui-refactoring
```

## Checklist Final (Antes de Merge)

Antes de considerar a refatoração completa, verificar:

### Funcionalidade
- [ ] Notificações funcionam perfeitamente
- [ ] Todas as páginas HTML migraram
- [ ] Dark mode funciona automaticamente
- [ ] Flags aparecem corretamente
- [ ] Botões de ação funcionam
- [ ] Não há erros no console

### Código
- [ ] Nenhum arquivo antigo sendo usado
- [ ] Todos os CSS usam variáveis
- [ ] Imports limpos e corretos
- [ ] Código comentado removido
- [ ] Manifest.json atualizado

### Design
- [ ] Material 3 aplicado em toda UI
- [ ] Consistência visual
- [ ] Dark mode perfeito
- [ ] Animações smooth
- [ ] Alinhamento pixel-perfect

### Performance
- [ ] Popup rápido (menor que 100ms)
- [ ] Panel injection rápida (menor que 200ms)
- [ ] Sem memory leaks
- [ ] Notificações não causam lag

### Documentação
- [ ] README atualizado
- [ ] CHANGELOG criado
- [ ] Screenshots atualizados
- [ ] Comentários no código

## Estimativa de Tempo Total

- FASE 1: 15 minutos
- FASE 2: 4-5 horas
- FASE 3: 3 horas
- FASE 4: 6-8 horas
- FASE 5: 1 hora
- FASE 6: 3 horas
- FASE 7: 4 horas
- FASE 8: 1 hora
- FASE 9: 3 horas
- FASE 10: 2 horas

**Total: 32-40 horas** (aproximadamente 5 dias de trabalho focado)

## Priorização (Se Tempo Limitado)

Se você precisar priorizar apenas o essencial:

### Crítico (Deve fazer)
- FASE 1: Preparação
- FASE 2: Notification Manager
- FASE 3: Integração Background
- FASE 4: Centralização CSS (pelo menos tasks 4.1, 4.2, 4.3)
- FASE 5: Auto Dark Mode
- FASE 8: Limpeza (tasks 8.1, 8.2, 8.3)
- FASE 9: Testes Funcionais (task 9.1)

**Tempo mínimo**: 20-25 horas

### Importante (Deveria fazer)
- FASE 4: Resto das tasks CSS
- FASE 6: Chrome Material 3 Expressive
- FASE 7: Flags e ícones
- FASE 9: Performance tests

**Tempo adicional**: 8-10 horas

### Opcional (Nice to have)
- FASE 10: Documentação completa
- FASE 9: Polimento visual extremo
- FASE 7: Chrome UI icons

**Tempo adicional**: 4-6 horas

## Contato e Suporte

Se você (agente Claude) encontrar algum problema ou ambiguidade:

1. Consulte primeiro os documentos em DOCS/
2. Verifique o código existente para padrões
3. Se ainda tiver dúvida, documente em "Problemas Conhecidos"
4. Continue com a próxima task e marque a problemática para revisão

## Última Atualização

**Data**: 2025-10-20
**Por**: Claude (Análise inicial)
**Fase Atual**: FASE 1 - PREPARAÇÃO
**Próxima Task**: Task 1.1 - Adicionar permission ao manifest
**Status**: Pronto para iniciar refatoração
