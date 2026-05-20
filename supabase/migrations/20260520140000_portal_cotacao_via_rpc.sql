-- Audit Bloco 1.4: portal de cotação atrás de RPCs SECURITY DEFINER
--
-- Antes: 3 tabelas (cotacoes, cotacao_links_publicos, cotacao_respostas_fornecedor)
--        com policy "FOR ALL TO public" — anon + authenticated com escrita aberta.
--        Cliente do portal forjava link_id/cotacao_id arbitrários.
-- Depois: 0 acesso anon às tabelas. 2 RPCs SECURITY DEFINER:
--         - get_cotacao_publica(token) -> {ok, link, cotacao, fornecedor} | {ok:false, reason}
--         - responder_cotacao(token, payload) -> {ok, resposta_id} | {ok:false, reason}
--         Token re-derivado server-side; insert + update do link feitos
--         atomicamente em uma transação com FOR UPDATE (one-time-use).
--
-- Hook React (useCotacaoLinksPublicos.ts) e portal (PortalCotacao.tsx)
-- atualizados pra consumir as RPCs.

DROP POLICY IF EXISTS "cotacoes_all" ON public.cotacoes;
DROP POLICY IF EXISTS "cotacao_links_publicos_all" ON public.cotacao_links_publicos;
DROP POLICY IF EXISTS "cotacao_respostas_all" ON public.cotacao_respostas_fornecedor;
DROP POLICY IF EXISTS "cotacoes_authenticated" ON public.cotacoes;
DROP POLICY IF EXISTS "cotacao_links_publicos_authenticated" ON public.cotacao_links_publicos;
DROP POLICY IF EXISTS "cotacao_respostas_authenticated" ON public.cotacao_respostas_fornecedor;

CREATE POLICY "cotacoes_authenticated" ON public.cotacoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "cotacao_links_publicos_authenticated" ON public.cotacao_links_publicos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "cotacao_respostas_authenticated" ON public.cotacao_respostas_fornecedor
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_cotacao_publica(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $fn$
DECLARE
  v_link record;
  v_cotacao record;
  v_fornecedor record;
  v_now timestamptz := now();
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 OR length(p_token) > 128 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;

  SELECT id, cotacao_id, fornecedor_id, expires_at, respondido, respondido_em
    INTO v_link
    FROM public.cotacao_links_publicos
    WHERE token = p_token
    LIMIT 1;

  IF v_link.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_link.expires_at < v_now THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired',
      'link', jsonb_build_object('id', v_link.id, 'expiresAt', v_link.expires_at, 'respondido', v_link.respondido));
  END IF;

  IF v_link.respondido THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'respondido',
      'link', jsonb_build_object('id', v_link.id, 'expiresAt', v_link.expires_at, 'respondido', true, 'respondidoEm', v_link.respondido_em));
  END IF;

  SELECT id, numero, descricao, descricao_livre, itens_pedido
    INTO v_cotacao
    FROM public.cotacoes
    WHERE id = v_link.cotacao_id
    LIMIT 1;

  IF v_cotacao.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cotacao_missing');
  END IF;

  SELECT id, nome INTO v_fornecedor
    FROM public.fornecedores
    WHERE id = v_link.fornecedor_id
    LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'link', jsonb_build_object(
      'id', v_link.id,
      'cotacaoId', v_link.cotacao_id,
      'fornecedorId', v_link.fornecedor_id,
      'expiresAt', v_link.expires_at,
      'respondido', v_link.respondido,
      'respondidoEm', v_link.respondido_em
    ),
    'cotacao', jsonb_build_object(
      'id', v_cotacao.id,
      'numero', v_cotacao.numero,
      'descricao', v_cotacao.descricao,
      'descricaoLivre', v_cotacao.descricao_livre,
      'itensPedido', v_cotacao.itens_pedido
    ),
    'fornecedor', CASE
      WHEN v_fornecedor.id IS NULL THEN NULL
      ELSE jsonb_build_object('id', v_fornecedor.id, 'nome', v_fornecedor.nome)
    END
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.responder_cotacao(p_token text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_link record;
  v_now timestamptz := now();
  v_resposta_id text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 OR length(p_token) > 128 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  END IF;

  SELECT id, cotacao_id, fornecedor_id, expires_at, respondido
    INTO v_link
    FROM public.cotacao_links_publicos
    WHERE token = p_token
    FOR UPDATE;

  IF v_link.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_link.expires_at < v_now THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  IF v_link.respondido THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'respondido');
  END IF;

  v_resposta_id := substr(md5(random()::text || clock_timestamp()::text), 1, 16);

  INSERT INTO public.cotacao_respostas_fornecedor (
    id, link_publico_id, cotacao_id, fornecedor_id, itens_resposta,
    condicao_pagamento, prazo_entrega, observacoes, assinatura_base64, respondido_em
  ) VALUES (
    v_resposta_id,
    v_link.id,
    v_link.cotacao_id,
    v_link.fornecedor_id,
    COALESCE(p_payload->'itensResposta', '[]'::jsonb),
    COALESCE(p_payload->>'condicaoPagamento', ''),
    COALESCE(p_payload->>'prazoEntrega', ''),
    COALESCE(p_payload->>'observacoes', ''),
    p_payload->>'assinaturaBase64',
    v_now
  );

  UPDATE public.cotacao_links_publicos
    SET respondido = true, respondido_em = v_now
    WHERE id = v_link.id;

  RETURN jsonb_build_object('ok', true, 'resposta_id', v_resposta_id);
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_cotacao_publica(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.responder_cotacao(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cotacao_publica(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.responder_cotacao(text, jsonb) TO anon, authenticated;
