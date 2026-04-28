-- ═══════════════════════════════════════════════════════════════════════════
-- Backfill: funcionários cadastrados antes do fix da foto de perfil
-- ficaram com foto_perfil = NULL apesar de terem fotos_referencia_facial.
-- Copia a primeira referência facial pra foto_perfil.
-- ═══════════════════════════════════════════════════════════════════════════

update public.apont_funcionarios
   set foto_perfil = fotos_referencia_facial[1]
 where foto_perfil is null
   and array_length(fotos_referencia_facial, 1) > 0;
