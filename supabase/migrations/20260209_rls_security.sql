-- ===========================================
-- RLS 보안 수정
-- 옛설판다 비즈니스 영어 학습 서비스
-- ===========================================

-- ========================================
-- 1. 모든 public 테이블에 RLS 활성화
-- ========================================

ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriber_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wrong_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kakao_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 2. config 테이블 정책
-- ========================================

CREATE POLICY "Anyone can read config"
ON public.config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage config"
ON public.config FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ========================================
-- 3. words 테이블 정책 (학습 단어)
-- ========================================

CREATE POLICY "Anyone can read words"
ON public.words FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage words"
ON public.words FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ========================================
-- 4. subscribers 테이블 정책
-- ========================================

CREATE POLICY "Users can view own subscription"
ON public.subscribers FOR SELECT TO authenticated
USING (email = auth.jwt() ->> 'email');

CREATE POLICY "Users can update own subscription"
ON public.subscribers FOR UPDATE TO authenticated
USING (email = auth.jwt() ->> 'email')
WITH CHECK (email = auth.jwt() ->> 'email');

CREATE POLICY "Service role can manage subscribers"
ON public.subscribers FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ========================================
-- 5. subscriber_settings 테이블 정책
-- ========================================

CREATE POLICY "Users can view own settings"
ON public.subscriber_settings FOR SELECT TO authenticated
USING (email = auth.jwt() ->> 'email');

CREATE POLICY "Users can update own settings"
ON public.subscriber_settings FOR UPDATE TO authenticated
USING (email = auth.jwt() ->> 'email')
WITH CHECK (email = auth.jwt() ->> 'email');

CREATE POLICY "Users can insert own settings"
ON public.subscriber_settings FOR INSERT TO authenticated
WITH CHECK (email = auth.jwt() ->> 'email');

CREATE POLICY "Service role can manage subscriber_settings"
ON public.subscriber_settings FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ========================================
-- 6. quiz_results 테이블 정책
-- ========================================

CREATE POLICY "Users can view own quiz results"
ON public.quiz_results FOR SELECT TO authenticated
USING (email = auth.jwt() ->> 'email');

CREATE POLICY "Users can insert own quiz results"
ON public.quiz_results FOR INSERT TO authenticated
WITH CHECK (email = auth.jwt() ->> 'email');

CREATE POLICY "Service role can manage quiz_results"
ON public.quiz_results FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ========================================
-- 7. wrong_words 테이블 정책
-- ========================================

CREATE POLICY "Users can view own wrong words"
ON public.wrong_words FOR SELECT TO authenticated
USING (email = auth.jwt() ->> 'email');

CREATE POLICY "Users can insert own wrong words"
ON public.wrong_words FOR INSERT TO authenticated
WITH CHECK (email = auth.jwt() ->> 'email');

CREATE POLICY "Service role can manage wrong_words"
ON public.wrong_words FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ========================================
-- 8. results 테이블 정책
-- ========================================

CREATE POLICY "Users can view own results"
ON public.results FOR SELECT TO authenticated
USING (email = auth.jwt() ->> 'email');

CREATE POLICY "Service role can manage results"
ON public.results FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ========================================
-- 9. attendance 테이블 정책
-- ========================================

CREATE POLICY "Users can view own attendance"
ON public.attendance FOR SELECT TO authenticated
USING (email = auth.jwt() ->> 'email');

CREATE POLICY "Service role can manage attendance"
ON public.attendance FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ========================================
-- 10. kakao_users 테이블 정책
-- ========================================

CREATE POLICY "Users can view own kakao info"
ON public.kakao_users FOR SELECT TO authenticated
USING (email = auth.jwt() ->> 'email');

CREATE POLICY "Service role can manage kakao_users"
ON public.kakao_users FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ========================================
-- 11. vault_secrets_list 뷰 수정
-- ========================================

DROP VIEW IF EXISTS public.vault_secrets_list;

CREATE VIEW public.vault_secrets_list
WITH (security_invoker = true)
AS
SELECT id, name, description, created_at, updated_at
FROM vault.secrets
ORDER BY name;

COMMENT ON VIEW public.vault_secrets_list IS 'List all secrets without revealing values';
