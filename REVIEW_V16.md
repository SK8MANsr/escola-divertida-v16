# V16 – Supabase operacional + admin inicial

## O que foi consolidado
- cloud save mantido com fallback local
- catálogo dinâmico remoto mantido com fallback local
- estúdio admin agora consegue carregar o catálogo remoto para edição
- publicação agora sincroniza integralmente o catálogo e desativa itens removidos do rascunho
- health check agora valida funções e tabelas essenciais com mais profundidade
- schema Supabase ampliado com `catalog_publications` e gatilhos de `updated_at`
- build simplificada para deploy padrão Vite + Netlify

## Ajustes críticos
- `buildPayload.version` atualizado para 16
- labels e documentação alinhadas com a V16
- publicação remota passou a registrar manifesto e contagens da publicação

## Observação
A chave local `escola-v14-variety-bonus` foi mantida por compatibilidade com progresso salvo de versões anteriores.
