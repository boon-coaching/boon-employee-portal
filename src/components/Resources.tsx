import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResources } from '../hooks/useResources';
import { usePortalData } from './ProtectedLayout';

const TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  article: {
    label: 'Article',
    color: 'text-boon-blue',
    bgColor: 'bg-boon-blue/10',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  video: {
    label: 'Video',
    color: 'text-boon-error',
    bgColor: 'bg-red-50',
    icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  framework: {
    label: 'Framework',
    color: 'text-boon-coral',
    bgColor: 'bg-boon-coral/12',
    icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
  },
  worksheet: {
    label: 'Worksheet',
    color: 'text-boon-success',
    bgColor: 'bg-boon-success/10',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  },
  podcast: {
    label: 'Podcast',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  },
  guide: {
    label: 'Guide',
    color: 'text-boon-success',
    bgColor: 'bg-boon-success/10',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
};

function TypeIcon({ type, size = 'md' }: { type: string; size?: 'sm' | 'md' }) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.article;
  const sizeClass = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div className={`${sizeClass} rounded-btn ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
      <svg className={`${iconSize} ${config.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={config.icon} />
      </svg>
    </div>
  );
}

export default function Resources() {
  const navigate = useNavigate();
  const data = usePortalData();
  const email = data.employee?.company_email;
  const { resources, tags, focusAreas, lowCompetencyNames, loading, error } = useResources(email, data.competencyScores);

  const [activeTopics, setActiveTopics] = useState<string[]>([]);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllTopics, setShowAllTopics] = useState(false);

  const topicTags = useMemo(() => tags.filter(t => t.category === 'topic'), [tags]);

  const resourceTypes = useMemo(() => {
    const types = new Set(resources.map(r => r.resource_type));
    return Array.from(types).sort();
  }, [resources]);

  // Recommended: resources whose competencies overlap with user's focus areas
  const focusAreaNames = useMemo(() => focusAreas.map(f => f.focus_area_name), [focusAreas]);

  const recommendedResources = useMemo(() => {
    const allRelevantAreas = [...new Set([...focusAreaNames, ...lowCompetencyNames])];
    if (allRelevantAreas.length === 0) return [];
    return resources.filter(r =>
      r.competencies?.some(c => allRelevantAreas.includes(c))
    );
  }, [resources, focusAreaNames, lowCompetencyNames]);

  // Filter logic
  const filteredResources = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return resources.filter(r => {
      if (query) {
        const matchesTitle = r.title.toLowerCase().includes(query);
        const matchesDesc = r.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return false;
      }
      if (activeType && r.resource_type !== activeType) return false;
      if (activeTopics.length > 0) {
        const resourceTags = r.tags || [];
        const resourceCompetencies = r.competencies || [];
        const allResourceLabels = [...resourceTags, ...resourceCompetencies];
        if (!activeTopics.some(topic => allResourceLabels.includes(topic))) return false;
      }
      return true;
    });
  }, [resources, activeType, activeTopics, searchQuery]);

  const toggleTopic = (name: string) => {
    setActiveTopics(prev =>
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    );
  };

  const toggleType = (type: string) => {
    setActiveType(prev => prev === type ? null : type);
  };

  const getResourceUrl = (r: { url: string | null; file_url: string | null }) => r.url || r.file_url || null;
  const hasUrl = (r: { url: string | null; file_url: string | null }) => !!(r.url || r.file_url);
  const hasContent = (r: { body_html: string | null }) => !!r.body_html;
  const isClickable = (_r: { url: string | null; file_url: string | null; body_html: string | null }) => true;

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <header className="text-center sm:text-left">
          <div className="h-9 w-48 bg-boon-offWhite rounded-btn animate-pulse" />
          <div className="h-5 w-72 bg-boon-offWhite rounded-btn animate-pulse mt-3" />
        </header>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white p-5 rounded-card border border-boon-charcoal/[0.08] shadow-sm">
              <div className="h-10 w-10 bg-boon-offWhite rounded-btn animate-pulse" />
              <div className="h-5 w-3/4 bg-boon-offWhite rounded animate-pulse mt-4" />
              <div className="h-4 w-full bg-boon-offWhite rounded animate-pulse mt-3" />
              <div className="h-4 w-2/3 bg-boon-offWhite rounded animate-pulse mt-2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8 animate-fade-in">
        <header className="text-center sm:text-left">
          <h1 className="font-display font-bold text-boon-navy text-[36px] leading-[1.05] tracking-[-0.025em]">Resources</h1>
        </header>
        <div className="text-center py-12 bg-white rounded-card border border-boon-charcoal/[0.08]">
          <p className="text-boon-charcoal/55">Something went wrong loading resources. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-32 md:pb-0">
      {/* Editorial hero matching the rest of the portal */}
      <header className="pb-6 mb-2 border-b border-boon-charcoal/10">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="w-6 h-px bg-boon-blue" aria-hidden />
          <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-blue">Resources</span>
        </div>
        <h1 className="font-display font-bold text-boon-navy tracking-[-0.025em] leading-[1.05] text-[36px] md:text-[44px]">
          The work between sessions.{' '}
          <span className="font-serif italic font-normal text-boon-coral">Build the muscle.</span>
        </h1>
      </header>

      {/* Recommended for You — hidden when searching */}
      {recommendedResources.length > 0 && !searchQuery && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-bold text-boon-charcoal/55 uppercase tracking-widest">Recommended for You</h2>
            <span
              className="text-boon-charcoal/40 cursor-help"
              title="Based on your coaching focus areas and competency scores"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-5 px-5 sm:mx-0 sm:px-0 scrollbar-hide">
            {recommendedResources.slice(0, 6).map(r => {
              const clickable = isClickable(r);
              const cardClass = `group flex-shrink-0 w-64 bg-gradient-to-br from-boon-blue/5 to-boon-lightBlue/20 p-5 rounded-card border border-boon-blue/10 transition-all ${
                clickable ? 'hover:border-boon-blue/30 cursor-pointer' : 'opacity-75'
              }`;
              const cardContent = (
                <>
                  <TypeIcon type={r.resource_type} size="sm" />
                  <h3 className={`font-bold transition-colors mt-3 line-clamp-2 leading-snug ${
                    clickable ? 'text-boon-navy group-hover:text-boon-blue' : 'text-boon-charcoal/55'
                  }`}>
                    {r.title}
                  </h3>
                  <p className="text-sm text-boon-charcoal/55 mt-2 line-clamp-2">{r.description}</p>
                  {r.duration && (
                    <p className="text-xs text-boon-charcoal/55 mt-2">{r.duration}</p>
                  )}
                  {r.competencies?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {r.competencies.slice(0, 2).map(c => {
                        const isGrowthArea = lowCompetencyNames.includes(c);
                        return (
                          <span key={c} className={`text-[10px] font-bold uppercase tracking-widest ${isGrowthArea ? 'text-boon-warning' : 'text-boon-blue/70'}`}>
                            {isGrowthArea ? `\u2191 ${c}` : c}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </>
              );
              if (hasContent(r)) {
                return (
                  <div key={r.id} className={cardClass} onClick={() => navigate(`/resources/${r.id}`)} role="button" tabIndex={0}>
                    {cardContent}
                  </div>
                );
              }
              if (hasUrl(r)) {
                return (
                  <a key={r.id} href={getResourceUrl(r)!} target="_blank" rel="noopener noreferrer" className={cardClass}>
                    {cardContent}
                  </a>
                );
              }
              // Resources with no content or URL still navigate to detail page
              return (
                <div key={r.id} className={cardClass + ' cursor-pointer'} onClick={() => navigate(`/resources/${r.id}`)} role="button" tabIndex={0}>
                  {cardContent}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-boon-charcoal/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search resources..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white rounded-card border border-boon-charcoal/[0.08] shadow-sm text-sm font-medium text-boon-navy placeholder:text-boon-charcoal/40 focus:outline-none focus:border-boon-blue/30 focus:ring-2 focus:ring-boon-blue/10 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-boon-charcoal/40 hover:text-boon-charcoal/55 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      {(topicTags.length > 0 || resourceTypes.length > 1) && (
        <div className="space-y-3">
          {/* Topic Filters */}
          {topicTags.length > 0 && (
            <div className={`bg-white p-2 rounded-card shadow-sm border border-boon-charcoal/[0.08] ${showAllTopics ? '' : 'overflow-x-auto'}`}>
              <div className={`flex gap-2 ${showAllTopics ? 'flex-wrap' : ''}`}>
                {(showAllTopics ? topicTags : topicTags.slice(0, 6)).map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTopic(tag.name)}
                    className={`px-4 py-2 rounded-btn text-sm font-bold transition-all whitespace-nowrap ${
                      activeTopics.includes(tag.name)
                        ? 'bg-boon-blue text-white shadow-sm'
                        : 'text-boon-charcoal/55 hover:bg-boon-offWhite'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
                {topicTags.length > 6 && (
                  <button
                    onClick={() => setShowAllTopics(prev => !prev)}
                    className="px-4 py-2 rounded-btn text-sm font-bold text-boon-blue hover:bg-boon-lightBlue/30 whitespace-nowrap transition-all"
                  >
                    {showAllTopics ? 'Less' : `+${topicTags.length - 6} More`}
                  </button>
                )}
                {activeTopics.length > 0 && (
                  <button
                    onClick={() => setActiveTopics([])}
                    className="px-3 py-2 rounded-btn text-sm font-medium text-boon-charcoal/55 hover:text-boon-charcoal/75 whitespace-nowrap transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Type Filters */}
          {resourceTypes.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {resourceTypes.map(type => {
                const config = TYPE_CONFIG[type];
                if (!config) return null;
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`px-4 py-2 rounded-btn text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                      activeType === type
                        ? 'bg-boon-blue text-white shadow-sm'
                        : 'bg-white text-boon-charcoal/55 hover:bg-boon-offWhite border border-boon-charcoal/[0.08] shadow-sm'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
                    </svg>
                    {config.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Resource Grid */}
      {filteredResources.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResources.map(r => {
            const clickable = isClickable(r);
            const cardClass = `group bg-white p-5 rounded-card border border-boon-charcoal/[0.08] shadow-sm transition-all flex flex-col ${
              clickable ? 'hover:shadow-md hover:border-boon-blue/30 cursor-pointer' : 'opacity-75'
            }`;
            const cardContent = (
              <>
                {/* Thumbnail or type icon */}
                {r.thumbnail_url ? (
                  <div className="w-full h-36 rounded-btn bg-boon-offWhite overflow-hidden mb-4">
                    <img
                      src={r.thumbnail_url}
                      alt={r.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <TypeIcon type={r.resource_type} />
                )}

                {/* Source + Type */}
                <div className="flex items-center gap-2 mt-3">
                  {r.source && (
                    <span className="text-[10px] font-bold text-boon-charcoal/55 uppercase tracking-widest truncate">
                      {r.source}
                    </span>
                  )}
                  {r.source && (
                    <span className="text-boon-charcoal/20">|</span>
                  )}
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${TYPE_CONFIG[r.resource_type]?.color || 'text-boon-charcoal/55'}`}>
                    {TYPE_CONFIG[r.resource_type]?.label || r.resource_type}
                  </span>
                </div>

                {/* Title */}
                <h3 className={`font-bold transition-colors leading-snug mt-2 line-clamp-2 ${
                  clickable ? 'text-boon-navy group-hover:text-boon-blue' : 'text-boon-charcoal/55'
                }`}>
                  {r.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-boon-charcoal/55 mt-2 line-clamp-2 flex-1">
                  {r.description}
                </p>

                {/* Duration */}
                {r.duration && (
                  <p className="text-xs text-boon-charcoal/55 mt-2">{r.duration}</p>
                )}

                {/* Tags + Badges */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {(r.competencies || []).slice(0, 2).map(c => (
                    <span key={c} className="px-2 py-0.5 bg-boon-offWhite text-[10px] font-bold text-boon-charcoal/55 uppercase tracking-wider rounded-btn">
                      {c}
                    </span>
                  ))}
                  {(r.competencies || []).length > 2 && (
                    <span className="text-[10px] font-bold text-boon-charcoal/40">
                      +{r.competencies.length - 2} more
                    </span>
                  )}
                  {(r.is_featured || r.is_boon_original) && (
                    <div className="ml-auto flex gap-1.5">
                      {r.is_featured && (
                        <span className="px-2 py-0.5 bg-boon-warning/12 text-[10px] font-bold text-boon-warning uppercase tracking-wider rounded-btn">
                          Featured
                        </span>
                      )}
                      {r.is_boon_original && (
                        <span className="px-2 py-0.5 bg-boon-lightBlue text-[10px] font-bold text-boon-blue uppercase tracking-wider rounded-btn">
                          Boon Original
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </>
            );
            if (hasContent(r)) {
              return (
                <div key={r.id} className={cardClass} onClick={() => navigate(`/resources/${r.id}`)}>
                  {cardContent}
                </div>
              );
            }
            return hasUrl(r) ? (
              <a key={r.id} href={getResourceUrl(r)!} target="_blank" rel="noopener noreferrer" className={cardClass}>
                {cardContent}
              </a>
            ) : (
              <div key={r.id} className={cardClass}>
                {cardContent}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-card border border-boon-charcoal/[0.08]">
          <svg className="w-12 h-12 text-boon-charcoal/20 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-boon-charcoal/55 font-medium">
            No resources found. {searchQuery ? 'Try a different search term.' : 'Try adjusting your filters.'}
          </p>
        </div>
      )}

      {/* Tip Card */}
      <section className="bg-boon-coral/12 p-8 rounded-card border border-boon-charcoal/[0.08]">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-coral">How to use this</span>
        <h3 className="mt-3 font-display font-bold text-boon-navy text-2xl tracking-[-0.02em] leading-[1.2]">
          One thing. <span className="font-serif italic font-normal">Try it.</span> Bring it back.
        </h3>
        <p className="mt-3 text-boon-charcoal/75 leading-relaxed">
          Pick one piece that lands where you are right now. Apply one concept before your next session, then bring what happened to your coach.
        </p>
      </section>
    </div>
  );
}
