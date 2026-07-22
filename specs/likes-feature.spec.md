# Spec: Like em Posts

**Projeto:** nestjs-intro  
**Versão da spec:** 1.0  
**Status:** Rascunho para revisão  
**Escopo:** Backend (API NestJS) + contrato para consumidores de UI  
**Data:** 2025-06-25

---

## Contexto do projeto

Aplicação NestJS com entidades `User`, `Post`, `Tag` e `MetaOption`. Posts possuem autor, status (`draft`, `scheduled`, `review`, `published`) e listagem paginada. Autenticação via JWT Bearer (e Google OAuth). Respostas da API seguem o envelope `{ apiVersion, data }`.

**Decisão de escopo desta spec:** likes aplicam-se exclusivamente a **Posts**. Não há entidade de comentários no projeto atual.

---

## 1. Objetivo da regra

Permitir que usuários autenticados expressem apreciação por um post por meio de um **like**, de forma:

- **Única por usuário/post** — um usuário não pode dar like mais de uma vez no mesmo post.
- **Reversível** — o usuário pode remover o like (unlike).
- **Observável** — consumidores da API (UI futura) conseguem exibir contagem total de likes e, para o usuário logado, se ele já curtiu o post.

**Por que existe:** aumentar engajamento e dar sinal social de relevância do conteúdo, sem alterar o fluxo de criação/edição de posts existente.

---

## 2. Comportamento esperado

### 2.1 Modelo de dados (conceitual)

| Entidade / campo | Descrição |
|---|---|
| `Like` | Relacionamento `(userId, postId)` com timestamp `createdAt`. Constraint única em `(userId, postId)`. |
| `Post.likesCount` (derivado ou denormalizado) | Total de likes do post. Pode ser calculado via query ou mantido em contador — ver ambiguidades. |

### 2.2 Endpoints propostos

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/posts/:postId/likes` | Bearer obrigatório | Registra like do usuário autenticado no post |
| `DELETE` | `/posts/:postId/likes` | Bearer obrigatório | Remove like do usuário autenticado no post |
| — | `GET /posts` (existente) | Público | Passa a incluir `likesCount` e, se autenticado, `likedByMe` por post |
| — | `GET /posts/:postId` *(novo ou extensão)* | Público | Detalhe do post com `likesCount` e `likedByMe` opcional |

> **Nota:** `GET /posts/:postId` não existe hoje. Esta spec assume sua criação ou extensão equivalente na listagem.

### 2.3 Regras de negócio

1. Apenas usuários autenticados podem dar/remover like.
2. Um usuário só pode ter **no máximo 1 like** ativo por post.
3. Like em post inexistente → `404 Not Found`.
4. Like duplicado (usuário já curtiu) → `409 Conflict` *(recomendado)* ou resposta idempotente `200` com estado atual — ver ambiguidades.
5. Unlike em post que o usuário **não** curtiu → `404 Not Found` ou `409 Conflict` — ver ambiguidades.
6. Visitantes não autenticados veem `likesCount`; `likedByMe` deve ser `false` ou omitido.
7. Usuário autenticado vê `likedByMe: true/false` nos posts retornados.

### 2.4 Posts elegíveis para like

| Status do post | Visitante vê post? | Pode receber like? |
|---|---|---|
| `published` | Sim (assumido) | **Sim** |
| `draft` | **Ambíguo** | **Ambíguo** |
| `scheduled` | **Ambíguo** | **Ambíguo** |
| `review` | **Ambíguo** | **Ambíguo** |

> Hoje `GET /posts` não filtra por status. A spec assume que likes só são permitidos em posts **`published`**, salvo decisão contrária.

### 2.5 Resposta de sucesso (like/unlike)

Envelope padrão do projeto:

```json
{
  "apiVersion": "1.0",
  "data": {
    "postId": 42,
    "likesCount": 15,
    "likedByMe": true
  }
}
```

### 2.6 Exclusão de post

Quando um post é deletado (`DELETE /posts?id=`), todos os likes associados devem ser removidos em cascata (FK `ON DELETE CASCADE` ou equivalente na aplicação).

---

## 3. Casos positivos

| # | Cenário | Resultado esperado |
|---|---|---|
| P1 | Usuário autenticado dá like em post `published` existente | `201 Created` ou `200 OK`; `likedByMe: true`; `likesCount` incrementado em 1 |
| P2 | Usuário autenticado remove like previamente dado | `200 OK`; `likedByMe: false`; `likesCount` decrementado em 1 |
| P3 | Usuário A e usuário B curtem o mesmo post | `likesCount` = 2; cada um vê `likedByMe: true` apenas no seu contexto |
| P4 | Visitante não autenticado lista posts | Vê `likesCount`; `likedByMe` ausente ou `false` |
| P5 | Usuário autenticado lista posts | Vê `likesCount` e `likedByMe` correto por post |
| P6 | Autor do post curte o próprio post | Like registrado normalmente *(assumido permitido)* |
| P7 | Post deletado | Likes associados removidos; não aparecem em consultas futuras |

---

## 4. Casos negativos

| # | Cenário | Resultado esperado |
|---|---|---|
| N1 | Like sem token / token inválido | `401 Unauthorized` |
| N2 | Like em post inexistente (`postId` inválido) | `404 Not Found` |
| N3 | Like duplicado (mesmo usuário, mesmo post) | `409 Conflict` *(padrão recomendado)* |
| N4 | Unlike sem like prévio | `404 Not Found` *(padrão recomendado)* |
| N5 | Like em post não publicado (`draft`, etc.) | `403 Forbidden` ou `404 Not Found` — ver ambiguidades |
| N6 | `postId` não numérico ou ≤ 0 | `400 Bad Request` |
| N7 | Token válido de usuário inexistente/deletado | `401 Unauthorized` |

---

## 5. Edge cases

| # | Cenário | Comportamento esperado |
|---|---|---|
| E1 | Dois likes simultâneos do mesmo usuário no mesmo post (race condition) | Apenas 1 like persistido; constraint única `(userId, postId)` garante integridade; uma requisição retorna sucesso, outra `409` |
| E2 | Unlike e like quase simultâneos | Estado final consistente com a última operação persistida |
| E3 | Post com 0 likes recebe primeiro like | `likesCount` passa de 0 para 1 |
| E4 | Último like removido | `likesCount` = 0; UI não exibe badge ou exibe "0" — ver UI |
| E5 | Usuário deletado *(não implementado hoje)* | Likes do usuário removidos ou órfãos — **fora de escopo** até existir delete de user |
| E6 | Paginação: usuário curtiu posts fora da página atual | `likedByMe` correto apenas nos posts da página retornada |
| E7 | Like → delete post → unlike tentado | `404 Not Found` (post não existe) |
| E8 | Contagem denormalizada dessincronizada | Job de reconciliação ou recálculo — **fora de escopo v1**; preferir contagem via query ou transação atômica |

---

## 6. Efeitos colaterais de UI

> Não há frontend no repositório. Estes efeitos descrevem o contrato esperado para consumidores da API.

| Área | Efeito |
|---|---|
| **Card/listagem de posts** | Exibir ícone de like + `likesCount`. Se autenticado, ícone preenchido quando `likedByMe === true`. |
| **Detalhe do post** | Mesmo padrão da listagem; botão like/unlike interativo apenas se logado. |
| **Visitante não logado** | Contagem visível; botão like desabilitado ou redireciona para login. |
| **Feedback imediato (optimistic UI)** | UI pode incrementar contador antes da resposta; deve reconciliar com `data.likesCount` retornado. |
| **Erro 409 (like duplicado)** | UI deve tratar como "já curtido" — manter estado liked, sem toast de erro agressivo. |
| **Erro 401** | Redirecionar para login ou exibir modal de autenticação. |
| **Loading state** | Botão like desabilitado durante requisição para evitar double-click. |
| **Acessibilidade** | Botão com `aria-pressed` refletindo `likedByMe`; contador anunciado por screen readers. |
| **Ordenação/filtros** | Nenhuma mudança na listagem existente *(v1)*; ordenar por "mais curtidos" fica fora de escopo. |

---

## 7. Fora de escopo (v1)

- Like em entidades que não sejam `Post` (tags, usuários, comentários).
- Comentários ou reações alternativas (dislike, emoji reactions).
- Notificações ao autor quando alguém curte ("X curtiu seu post").
- Feed ordenado por popularidade / trending.
- Lista pública de "quem curtiu" (`GET /posts/:id/likes/users`).
- Rate limiting específico para likes.
- Analytics, métricas agregadas ou dashboard de engajamento.
- WebSockets / push em tempo real da contagem.
- Soft delete de posts (hoje é hard delete).
- Moderação ou bloqueio de likes por admin.
- Sincronização de likes com sistemas externos.

---

## 8. Ambiguidades e assumptions

> **Itens abertos — requerem decisão do time antes da implementação.**

### 8.1 Ambiguidades (decisão pendente)

| ID | Ambiguidade | Opções | Recomendação |
|---|---|---|---|
| A1 | **Quais status de post aceitam like?** | (a) só `published`; (b) qualquer status; (c) `published` + autor pode curtir rascunho próprio | **(a)** — alinha com conteúdo público |
| A2 | **Like duplicado: erro ou idempotente?** | (a) `409 Conflict`; (b) `200 OK` sem alterar contador | **(a)** — mais explícito para debug; UI trata como sucesso visual |
| A3 | **Unlike sem like prévio** | (a) `404`; (b) `200` idempotente | **(a)** — consistente com recurso inexistente |
| A4 | **Autor pode curtir o próprio post?** | (a) sim; (b) não | **(a)** — comportamento comum em blogs |
| A5 | **`likesCount`: calculado ou denormalizado?** | (a) `COUNT(*)` em query; (b) coluna `likesCount` na tabela `Post` | **(a)** para v1 — simplicidade; **(b)** se performance for crítica |
| A6 | **Endpoint de detalhe do post** | (a) criar `GET /posts/:postId`; (b) enriquecer só listagem paginada | **(a)** — necessário para tela de detalhe |
| A7 | **`likedByMe` para visitante** | (a) omitir campo; (b) retornar `false` | **(b)** — contrato mais previsível |
| A8 | **Visibilidade de posts não publicados na listagem** | Hoje não há filtro. Likes em drafts expõem conteúdo? | Definir política de visibilidade **antes** de likes |
| A9 | **Código HTTP do like criado** | `201 Created` vs `200 OK` | **`201`** se criar recurso `Like`; **`200`** se tratar como ação no post |

### 8.2 Assumptions adotadas nesta spec

1. Like é **binário** (curtiu / não curtiu) — sem half-states.
2. Identificação do usuário via `ActiveUserData.sub` (JWT).
3. Apenas posts **`published`** são likeáveis, até decisão contrária (A1).
4. Autor **pode** curtir próprio post (A4).
5. Respostas mantêm o envelope `{ apiVersion, data }` via `DataResponseInterceptor`.
6. Não há frontend neste repo; UI é consumidor hipotético da API.
7. Delete de post remove likes em cascata.
8. Não há delete de usuário implementado; impacto em likes de usuário deletado fica indefinido.

---

## 9. Critérios de aceite (Given / When / Then)

### CA-01 — Like com sucesso

```gherkin
Given um usuário autenticado com token válido
  And um post com status "published" e id conhecido
  And o usuário ainda não curtiu esse post
When ele envia POST /posts/{postId}/likes com Authorization Bearer
Then a resposta é 201 (ou 200, conforme A9)
  And data.likedByMe é true
  And data.likesCount é incrementado em 1 em relação ao valor anterior
  And existe exatamente 1 registro Like para (userId, postId)
```

### CA-02 — Like duplicado

```gherkin
Given um usuário autenticado que já curtiu o post {postId}
When ele envia POST /posts/{postId}/likes novamente
Then a resposta é 409 Conflict
  And data.likesCount permanece inalterado
  And continua existindo apenas 1 registro Like para (userId, postId)
```

### CA-03 — Unlike com sucesso

```gherkin
Given um usuário autenticado que já curtiu o post {postId}
When ele envia DELETE /posts/{postId}/likes
Then a resposta é 200 OK
  And data.likedByMe é false
  And data.likesCount é decrementado em 1
  And não existe registro Like para (userId, postId)
```

### CA-04 — Unlike sem like prévio

```gherkin
Given um usuário autenticado que NÃO curtiu o post {postId}
When ele envia DELETE /posts/{postId}/likes
Then a resposta é 404 Not Found
```

### CA-05 — Like não autenticado

```gherkin
Given um visitante sem token de autenticação
When ele envia POST /posts/{postId}/likes
Then a resposta é 401 Unauthorized
```

### CA-06 — Like em post inexistente

```gherkin
Given um usuário autenticado
When ele envia POST /posts/999999/likes
  And não existe post com id 999999
Then a resposta é 404 Not Found
```

### CA-07 — Listagem com contagem (visitante)

```gherkin
Given um post "published" com 3 likes de usuários distintos
  And um visitante não autenticado
When ele envia GET /posts
Then cada post na resposta inclui likesCount
  And o post em questão tem likesCount = 3
  And likedByMe é false ou está ausente
```

### CA-08 — Listagem com likedByMe (autenticado)

```gherkin
Given um usuário autenticado que curtiu o post {postId}
  And outro post que ele não curtiu
When ele envia GET /posts com Authorization Bearer
Then o post {postId} tem likedByMe = true
  And os demais posts têm likedByMe = false
```

### CA-09 — Like em post não publicado

```gherkin
Given um post com status "draft"
  And um usuário autenticado (não autor ou autor — conforme A1)
When ele envia POST /posts/{postId}/likes
Then a resposta é 403 Forbidden (ou 404, conforme política A1/A8)
```

### CA-10 — Cascata ao deletar post

```gherkin
Given um post com 5 likes registrados
When um admin/autor deleta o post via DELETE /posts?id={postId}
Then o post não existe mais
  And todos os 5 registros Like associados foram removidos
```

### CA-11 — Integridade concorrente

```gherkin
Given um usuário autenticado
When duas requisições POST /posts/{postId}/likes chegam simultaneamente
Then exatamente uma retorna sucesso (201/200)
  And a outra retorna 409 Conflict
  And likesCount do post é incrementado apenas 1 vez
```

---

## 10. Impacto técnico previsto (referência, não implementação)

| Área | Mudança esperada |
|---|---|
| Nova entidade | `Like` (TypeORM) |
| Módulo | `LikesModule` ou extensão de `PostsModule` |
| Migration | Tabela `like` com unique `(userId, postId)` |
| Posts | DTOs/responses enriquecidos com `likesCount`, `likedByMe` |
| Auth | Endpoints de like/unlike com `@Auth(AuthType.Bearer)` |
| Testes | e2e para CAs acima |

---

## 11. Checklist de revisão antes de implementar

- [ ] Decidir A1 — status elegíveis para like
- [ ] Decidir A2/A3 — idempotência vs erro explícito
- [ ] Decidir A5 — contagem calculada vs denormalizada
- [ ] Decidir A6 — criar `GET /posts/:postId` ou não
- [ ] Decidir A8 — filtro de visibilidade na listagem de posts
- [ ] Validar CA-09 com regra de autor em drafts
- [ ] Alinhar códigos HTTP finais (201 vs 200, 403 vs 404)

---

*Documento gerado para revisão de produto. Nenhuma implementação incluída.*
