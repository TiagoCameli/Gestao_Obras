import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { getEntityConfig } from './configs';
import EntityCadastroPage from './EntityCadastroPage';

export default function EntityCadastroRoute() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  // Capture once on first render whether ?import=1 was in the URL.
  const [autoImport] = useState(() => searchParams.get('import') === '1');

  useEffect(() => {
    if (searchParams.get('import') === '1') {
      const next = new URLSearchParams(searchParams);
      next.delete('import');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const config = slug ? getEntityConfig(slug) : undefined;
  if (!config) return <Navigate to="/cadastros" replace />;

  return <EntityCadastroPage key={config.slug} config={config} autoOpenImport={autoImport} />;
}
