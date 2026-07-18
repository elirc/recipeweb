import { Link } from 'react-router-dom';
import type { Recipe } from '../types';
import { CUISINE_LABELS } from '../types';
import { useShoppingList } from '../store/ShoppingListContext';

const DIFFICULTY_LABEL = { easy: '● Easy', medium: '●● Medium', hard: '●●● Hard' };

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  const { isInList, toggleRecipe } = useShoppingList();
  const inList = isInList(recipe.slug);

  return (
    <article className="recipe-card">
      <div className="card-top">
        <span className={`cuisine-tag ${recipe.cuisine}`}>
          {CUISINE_LABELS[recipe.cuisine]}
        </span>
        <span className="difficulty">{DIFFICULTY_LABEL[recipe.difficulty]}</span>
      </div>
      <div className="card-body">
        <h3>
          <Link to={`/recipe/${recipe.slug}`}>{recipe.name}</Link>
        </h3>
        {recipe.nativeName && <p className="native-name">{recipe.nativeName}</p>}
        <p className="card-desc">{recipe.description}</p>
        <div className="card-meta">
          {recipe.servings && <span>Serves {recipe.servings}</span>}
          {recipe.prepTime && <span>Prep {recipe.prepTime}</span>}
          {recipe.cookTime && <span>Cook {recipe.cookTime}</span>}
          <span>{recipe.ingredients.length} ingredients</span>
        </div>
      </div>
      <div className="card-actions">
        <Link to={`/recipe/${recipe.slug}`} className="btn btn-outline btn-sm">
          View recipe
        </Link>
        <button
          className={`btn btn-sm ${inList ? 'btn-added' : 'btn-primary'}`}
          onClick={() => toggleRecipe(recipe.slug)}
        >
          {inList ? '✓ On shopping list' : '+ Shopping list'}
        </button>
      </div>
    </article>
  );
}
