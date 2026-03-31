import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Resource {
  id: string;
  title: string;
  description: string | null;
  resource_type: string;
  url: string | null;
  file_url: string | null;
  thumbnail_url: string | null;
  source: string | null;
  is_boon_original: boolean;
  competencies: string[];
  tags: string[];
  program_types: string[] | null;
  is_featured: boolean;
  duration: string | null;
  body_html: string | null;
  is_published: boolean;
  display_order: number;
  created_at: string;
}

interface ResourceTag {
  id: string;
  name: string;
  category: string;
  display_order: number;
}

interface FocusArea {
  focus_area_name: string;
  focus_area_category: string;
  is_primary: boolean;
}

interface UseResourcesReturn {
  resources: Resource[];
  tags: ResourceTag[];
  focusAreas: FocusArea[];
  loading: boolean;
  error: string | null;
}

export function useResources(email: string | undefined): UseResourcesReturn {
  const [resources, setResources] = useState<Resource[]>([]);
  const [tags, setTags] = useState<ResourceTag[]>([]);
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setError(null);

      try {
        const [resourcesRes, tagsRes, focusRes] = await Promise.all([
          supabase
            .from('resources')
            .select('*')
            .eq('is_published', true)
            .order('is_featured', { ascending: false })
            .order('created_at', { ascending: false }),
          supabase
            .from('resource_tags')
            .select('*')
            .order('category')
            .order('display_order', { ascending: true }),
          email
            ? supabase
                .from('focus_area_selections')
                .select('focus_area_name, focus_area_category, is_primary')
                .eq('email', email)
                .eq('selected', true)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (cancelled) return;

        if (resourcesRes.error) throw resourcesRes.error;
        if (tagsRes.error) throw tagsRes.error;
        if (focusRes.error) throw focusRes.error;

        setResources(resourcesRes.data || []);
        setTags(tagsRes.data || []);
        setFocusAreas(focusRes.data || []);
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load resources';
          setError(message);
          console.error('useResources error:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [email]);

  return { resources, tags, focusAreas, loading, error };
}
