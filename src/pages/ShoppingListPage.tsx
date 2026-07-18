import { Link } from 'react-router-dom';
import { useShoppingList } from '../store/ShoppingListContext';
import IngredientChecklist, { ingredientsToText } from '../components/IngredientChecklist';
import { useCopy } from '../hooks/useCopy';

export default function ShoppingListPage() {
  const { recipes, checked, toggleChecked, removeRecipe, clearChecked, clearAll } =
    useShoppingList();
  const [copied, copy] = useCopy();

  const fullListText = () =>
    recipes.map((r) => ingredientsToText(r.name, r.ingredients)).join('\n\n');

  if (recipes.length === 0) {
    return (
      <div className="shopping-page">
        <div className="container">
          <h1>Shopping list</h1>
          <p className="page-sub">
            Add recipes and their complete ingredient lists show up here, ready to
            take to the store.
          </p>
          <div className="empty-state">
            <h2>Nothing here yet</h2>
            <p>Browse the cookbook and add a recipe or two.</p>
            <Link to="/" className="btn btn-primary">
              Browse recipes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shopping-page">
      <div className="container">
        <h1>Shopping list</h1>
        <p className="page-sub">
          {recipes.length} recipe{recipes.length === 1 ? '' : 's'} to shop for. Check
          items off as you go — your progress is saved on this device.
        </p>

        <div className="shopping-toolbar">
          <button className="btn btn-primary" onClick={() => copy(fullListText())}>
            {copied ? 'Copied!' : 'Copy entire list'}
          </button>
          <button className="btn btn-outline" onClick={clearChecked}>
            Uncheck everything
          </button>
          <button className="btn btn-outline" onClick={clearAll}>
            Clear list
          </button>
        </div>

        <div className="shopping-grid">
          {recipes.map((recipe) => {
            const total = recipe.ingredients.length;
            const done = recipe.ingredients.filter(
              (_, i) => checked[`${recipe.slug}:${i}`],
            ).length;
            return (
              <section key={recipe.slug} className="panel shopping-card">
                <div className="head">
                  <div>
                    <h3>
                      <Link to={`/recipe/${recipe.slug}`}>{recipe.name}</Link>
                    </h3>
                    <p className="source-line">
                      from{' '}
                      <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
                        {recipe.sourceName}
                      </a>
                    </p>
                  </div>
                  <button className="remove-btn" onClick={() => removeRecipe(recipe.slug)}>
                    Remove
                  </button>
                </div>
                {done > 0 && (
                  <p className="progress-line">
                    {done}/{total} in the cart
                  </p>
                )}
                <IngredientChecklist
                  slug={recipe.slug}
                  ingredients={recipe.ingredients}
                  checked={checked}
                  onToggle={toggleChecked}
                />
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
