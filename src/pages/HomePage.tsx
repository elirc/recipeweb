import { useMemo, useState } from 'react';
import { RECIPES } from '../data/recipes';
import type { Category, Cuisine } from '../types';
import { CATEGORY_LABELS, CUISINE_LABELS } from '../types';
import RecipeCard from '../components/RecipeCard';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];
const CUISINE_FILTERS: (Cuisine | 'all')[] = [
  'all',
  ...(Object.keys(CUISINE_LABELS) as Cuisine[]),
];

export default function HomePage() {
  const [cuisine, setCuisine] = useState<Cuisine | 'all'>('all');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return RECIPES.filter((r) => {
      if (cuisine !== 'all' && r.cuisine !== cuisine) return false;
      if (category !== 'all' && r.category !== category) return false;
      if (q) {
        const haystack = [
          r.name,
          r.nativeName ?? '',
          r.description,
          r.sourceName,
          ...r.tags,
          ...r.ingredients.map((i) => i.item),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [cuisine, category, query]);

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>
            Cook something <span className="accent">sarap</span>, something{' '}
            <span className="accent">ngon</span>
          </h1>
          <p>
            {RECIPES.length} classic Filipino, Vietnamese, Thai, and Spanish
            recipes from the web's best cooks — each with a link to the original
            and a ready-to-shop ingredient list, so trying something new is never
            daunting.
          </p>
        </div>
      </section>

      <section className="filters container">
        <div className="search-row">
          <input
            type="search"
            className="search-input"
            placeholder="Search recipes, ingredients, tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search recipes"
          />
        </div>
        <div className="chip-row" role="group" aria-label="Filter by cuisine">
          {CUISINE_FILTERS.map((c) => (
            <button
              key={c}
              className={`chip ${c}${cuisine === c ? ' selected' : ''}`}
              onClick={() => setCuisine(c)}
            >
              {c === 'all' ? 'All cuisines' : CUISINE_LABELS[c]}
            </button>
          ))}
        </div>
        <div className="chip-row" role="group" aria-label="Filter by category">
          <button
            className={`chip${category === 'all' ? ' selected' : ''}`}
            onClick={() => setCategory('all')}
          >
            Everything
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`chip${category === c ? ' selected' : ''}`}
              onClick={() => setCategory(c)}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <p className="result-count">
          {filtered.length} recipe{filtered.length === 1 ? '' : 's'}
        </p>
      </section>

      <section className="container">
        <div className="recipe-grid">
          {filtered.map((r) => (
            <RecipeCard key={r.slug} recipe={r} />
          ))}
        </div>
      </section>
    </>
  );
}
