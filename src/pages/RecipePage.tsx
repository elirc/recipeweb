import { Link, useParams } from 'react-router-dom';
import { RECIPES } from '../data/recipes';
import { CATEGORY_LABELS, CUISINE_LABELS } from '../types';
import { useShoppingList } from '../store/ShoppingListContext';
import IngredientChecklist, { ingredientsToText } from '../components/IngredientChecklist';
import { useCopy } from '../hooks/useCopy';

export default function RecipePage() {
  const { slug } = useParams<{ slug: string }>();
  const recipe = RECIPES.find((r) => r.slug === slug);
  const { isInList, toggleRecipe, checked, toggleChecked } = useShoppingList();
  const [copied, copy] = useCopy();

  if (!recipe) {
    return (
      <div className="recipe-page container">
        <div className="empty-state">
          <h2>Recipe not found</h2>
          <p>That dish isn't in the cookbook (yet).</p>
          <Link to="/" className="btn btn-primary">
            Back to all recipes
          </Link>
        </div>
      </div>
    );
  }

  const inList = isInList(recipe.slug);
  const sourceHost = new URL(recipe.sourceUrl).hostname.replace(/^www\./, '');

  return (
    <div className="recipe-page">
      <div className="container">
        <p className="breadcrumb">
          <Link to="/">All recipes</Link> / {CUISINE_LABELS[recipe.cuisine]} /{' '}
          {CATEGORY_LABELS[recipe.category]}
        </p>

        <header className="recipe-header">
          <span className={`cuisine-tag ${recipe.cuisine}`}>
            {CUISINE_LABELS[recipe.cuisine]}
          </span>
          <h1>{recipe.name}</h1>
          {recipe.nativeName && <p className="native-name">{recipe.nativeName}</p>}
          <p className="card-desc">{recipe.description}</p>
          <div className="meta-strip">
            {recipe.servings && (
              <span className="meta-pill">
                Serves <strong>{recipe.servings}</strong>
              </span>
            )}
            {recipe.prepTime && (
              <span className="meta-pill">
                Prep <strong>{recipe.prepTime}</strong>
              </span>
            )}
            {recipe.cookTime && (
              <span className="meta-pill">
                Cook <strong>{recipe.cookTime}</strong>
              </span>
            )}
            <span className="meta-pill">
              Difficulty <strong>{recipe.difficulty}</strong>
            </span>
          </div>
        </header>

        <div className="recipe-columns">
          <section className="panel">
            <h2>Ingredients</h2>
            <p className="panel-sub">
              The complete list from the original recipe — tap items to check them
              off as you shop.
            </p>
            <IngredientChecklist
              slug={recipe.slug}
              ingredients={recipe.ingredients}
              checked={checked}
              onToggle={toggleChecked}
            />
          </section>

          <aside className="side-stack">
            <section className="panel source-panel">
              <h2>Cook it</h2>
              <p>
                Full step-by-step instructions live on {recipe.sourceName} — the
                original creator's page.
              </p>
              <a
                className="btn btn-primary btn-block"
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open original recipe ↗
              </a>
              <p style={{ marginTop: 10, fontSize: '0.8rem' }}>{sourceHost}</p>
            </section>

            <section className="panel">
              <h2>Shop it</h2>
              <p className="panel-sub">
                Add this recipe to your combined shopping list or copy the
                ingredients anywhere.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  className={`btn btn-block ${inList ? 'btn-added' : 'btn-primary'}`}
                  onClick={() => toggleRecipe(recipe.slug)}
                >
                  {inList ? '✓ On shopping list' : '+ Add to shopping list'}
                </button>
                <button
                  className="btn btn-outline btn-block"
                  onClick={() => copy(ingredientsToText(recipe.name, recipe.ingredients))}
                >
                  {copied ? 'Copied!' : 'Copy ingredient list'}
                </button>
                {inList && (
                  <Link to="/shopping-list" className="btn btn-outline btn-block">
                    View shopping list →
                  </Link>
                )}
              </div>
              <div className="tag-row">
                {recipe.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
