import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { usePortalData } from './ProtectedLayout';
import { useResources } from '../hooks/useResources';

interface Resource {
  id: string;
  title: string;
  description: string | null;
  body_html: string | null;
  competencies: string[];
}

export function ResourceDetail() {
  const { id } = useParams<{ id: string }>();
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(800);

  const data = usePortalData();
  const email = data.employee?.company_email;
  const { focusAreas, lowCompetencyNames } = useResources(email, data.competencyScores);

  const matchingCompetency = useMemo(() => {
    if (!resource?.competencies) return null;
    const focusAreaNames = focusAreas.map(f => f.focus_area_name);
    const allRelevant = [...new Set([...focusAreaNames, ...lowCompetencyNames])];
    return resource.competencies.find(c => allRelevant.includes(c)) || null;
  }, [resource, focusAreas, lowCompetencyNames]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('resources')
        .select('id, title, description, body_html, competencies')
        .eq('id', id)
        .single();

      if (cancelled) return;
      if (err) {
        setError('Resource not found');
      } else {
        setResource(data);
      }
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, [id]);

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Try to measure content height after load
    try {
      const doc = iframe.contentDocument;
      if (doc?.body) {
        const height = doc.body.scrollHeight;
        if (height > 0) setIframeHeight(height + 40);

        // Watch for dynamic content changes (tab switches, quiz interactions)
        const observer = new ResizeObserver(() => {
          const h = doc.body.scrollHeight;
          if (h > 0) setIframeHeight(h + 40);
        });
        observer.observe(doc.body);
      }
    } catch {
      // Cross-origin fallback: use a generous fixed height
      setIframeHeight(3000);
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
        <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-[600px] bg-white rounded-2xl border border-gray-100 animate-pulse" />
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Link to="/resources" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-boon-blue transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Resources
        </Link>
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <p className="text-gray-400 font-medium">Resource not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link to="/resources" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-boon-blue transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Resources
        </Link>
        {resource.competencies?.length > 0 && (
          <div className="flex gap-1.5">
            {resource.competencies.map(c => (
              <span key={c} className="px-2.5 py-1 bg-boon-lightBlue text-[11px] font-extrabold text-boon-blue uppercase tracking-wider rounded-lg">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {matchingCompetency && (
        <div className="mb-4 px-4 py-3 bg-boon-lightBlue/30 border border-boon-blue/10 rounded-xl">
          <p className="text-sm text-boon-blue font-medium">
            Recommended because you're working on {matchingCompetency}
          </p>
        </div>
      )}

      {/* Iframe */}
      {resource.body_html && (
        <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
          <iframe
            ref={iframeRef}
            srcDoc={resource.body_html}
            title={resource.title}
            className="w-full border-0"
            style={{ height: iframeHeight }}
            onLoad={handleIframeLoad}
            sandbox="allow-scripts allow-same-origin allow-popups allow-top-navigation"
          />
        </div>
      )}
    </div>
  );
}

export default ResourceDetail;
