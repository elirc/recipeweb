import type { Ingredient } from '../types';

interface Props {
  slug: string;
  ingredients: Ingredient[];
  checked: Record<string, boolean>;
  onToggle: (key: string) => void;
  onQuantityChange?: (key: string, value: string) => void;
}

/**
 * Renders a checkable ingredient list, preserving the source recipe's
 * ingredient groups (e.g. "Marinade", "Nuoc cham").
 */
export default function IngredientChecklist({ slug, ingredients, checked, onToggle, onQuantityChange }: Props) {
  // Preserve original order while grouping consecutive items.
  const sections: { group: string | null; items: { ing: Ingredient; index: number }[] }[] = [];
  ingredients.forEach((ing, index) => {
    const last = sections[sections.length - 1];
    if (last && last.group === ing.group) {
      last.items.push({ ing, index });
    } else {
      sections.push({ group: ing.group, items: [{ ing, index }] });
    }
  });

  return (
    <div>
      {sections.map((section, si) => (
        <div key={si}>
          {section.group && <p className="ingredient-group-title">{section.group}</p>}
          <ul className="ingredient-list">
            {section.items.map(({ ing, index }) => {
              const key = `${slug}:${index}`;
              const isChecked = Boolean(checked[key]);
              return (
                <li key={index}>
                  <button
                    type="button"
                    className={`ingredient-row${isChecked ? ' checked' : ''}`}
                    onClick={() => onToggle(key)}
                    aria-pressed={isChecked}
                  >
                    <span className="box" aria-hidden="true">
                      {isChecked ? '✓' : ''}
                    </span>
                    <span className="label">
                      {ing.quantity && <span className="qty">{ing.quantity}</span>}
                      {ing.item}
                    </span>
                  </button>
                  {onQuantityChange && (
                    <label className="quantity-control">
                      <span>Quantity for {ing.item}</span>
                      <input type="text" maxLength={100} value={ing.quantity}
                        onChange={(event) => onQuantityChange(key, event.target.value)} />
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Plain-text version of an ingredient list, for copying. */
export function ingredientsToText(name: string, ingredients: Ingredient[]): string {
  const lines: string[] = [name.toUpperCase()];
  let lastGroup: string | null = null;
  for (const ing of ingredients) {
    if (ing.group !== lastGroup) {
      lastGroup = ing.group;
      if (ing.group) lines.push(`\n${ing.group}:`);
    }
    lines.push(`- ${[ing.quantity, ing.item].filter(Boolean).join(' ')}`);
  }
  return lines.join('\n');
}
