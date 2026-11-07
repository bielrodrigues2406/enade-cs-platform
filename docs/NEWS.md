# Novidades (NEWS-1)

Pedido de Gabriel em 07/11/2026: avisar quem estuda sobre o que mudou na plataforma, com o Dudu. Faz parte do PR G de [PLANO-RETA-FINAL.md](PLANO-RETA-FINAL.md).

## 1. Onde está

| Parte | Arquivo |
| --- | --- |
| Texto das novidades | `data/news/news.json` |
| O que cada identidade já viu | migration `033_news_seen.sql` (`news_seen`) |
| API | `apps/api/src/news.ts`: `GET /api/news` e `POST /api/news/seen` ([API.md](API.md)) |
| Tela | `news.service.ts`, `news-dialog.component.*`, botão no topo (`app.component.html`) e cartão no início (`home.component.html`) |
| Testes | `tests/news.test.ts`, `tests/browser/news.spec.ts` |

## 2. Como aparece

- **Topo:** botão "Novidades" com a marca "Novo" enquanto houver novidade não vista. No celular fica só a estrela e a marca.
- **Início:** cartão com os três títulos mais recentes e o botão "Ver as novidades".
- **Diálogo:** Dudu na pose `novidade`, a lista com data, título, resumo e um botão que leva à seção. Fechar (Entendi, X ou Esc) marca as novas como vistas no servidor.
- **Aviso automático:** abre sozinho uma vez por carga, só se houver novidade não vista **e** a pessoa já tiver respondido alguma questão. Quem acabou de chegar vê só a marca e o cartão. Também não abre na apresentação, numa questão aberta, em treino, em prova nem nas áreas de gestão.
- Visitantes sem conta também têm o que viram guardado, pela identidade da sessão.

## 3. Como publicar uma novidade

Acrescente um item no início de `data/news/news.json`:

```json
{
  "id": "2026-11-licoes-todas-as-areas",
  "date": "2026-11-20",
  "title": "Até 80 caracteres",
  "summary": "Até 400 caracteres, dizendo o que mudou e por que importa para a prova.",
  "action": { "label": "Até 40 caracteres", "destination": "biblioteca" }
}
```

- `id` único, só minúsculas, números e hífen. **Não mude o `id`** de uma novidade publicada: quem já a viu voltaria a ver.
- `destination` aceita `inicio`, `questoes`, `geradas` (o banco filtrado nas geradas), `biblioteca`, `flashcards`, `conquistas`, `provas` e `treino`. `action` pode ser `null`.
- O validador recusa id repetido, data fora do formato `AAAA-MM-DD` e destino desconhecido; `npm test` roda essa validação.
- A novidade entra no ar com o próximo deploy, sem migration.
