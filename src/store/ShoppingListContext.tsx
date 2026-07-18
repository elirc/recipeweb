import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { RECIPES } from '../data/recipes';
import type { Recipe } from '../types';

interface ShoppingListState {
  /** slugs of recipes added to the shopping list */
  recipeSlugs: string[];
  /** keys of checked-off ingredients: `${slug}:${index}` */
  checked: Record<string, boolean>;
}

interface ShoppingListContextValue {
  recipes: Recipe[];
  recipeSlugs: string[];
  checked: Record<string, boolean>;
  isInList: (slug: string) => boolean;
  addRecipe: (slug: string) => void;
  removeRecipe: (slug: string) => void;
  toggleRecipe: (slug: string) => void;
  toggleChecked: (key: string) => void;
  clearChecked: () => void;
  clearAll: () => void;
  count: number;
}

const STORAGE_KEY = 'recipeweb.shoppingList.v1';

function loadState(): ShoppingListState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ShoppingListState;
      if (Array.isArray(parsed.recipeSlugs) && typeof parsed.checked === 'object') {
        return {
          recipeSlugs: parsed.recipeSlugs.filter((s) =>
            RECIPES.some((r) => r.slug === s),
          ),
          checked: parsed.checked ?? {},
        };
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return { recipeSlugs: [], checked: {} };
}

const ShoppingListContext = createContext<ShoppingListContextValue | null>(null);

export function ShoppingListProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ShoppingListState>(loadState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable (private mode etc.) — keep in memory only
    }
  }, [state]);

  const addRecipe = useCallback((slug: string) => {
    setState((s) =>
      s.recipeSlugs.includes(slug)
        ? s
        : { ...s, recipeSlugs: [...s.recipeSlugs, slug] },
    );
  }, []);

  const removeRecipe = useCallback((slug: string) => {
    setState((s) => ({
      recipeSlugs: s.recipeSlugs.filter((x) => x !== slug),
      checked: Object.fromEntries(
        Object.entries(s.checked).filter(([k]) => !k.startsWith(`${slug}:`)),
      ),
    }));
  }, []);

  const toggleRecipe = useCallback(
    (slug: string) => {
      setState((s) =>
        s.recipeSlugs.includes(slug)
          ? {
              recipeSlugs: s.recipeSlugs.filter((x) => x !== slug),
              checked: Object.fromEntries(
                Object.entries(s.checked).filter(
                  ([k]) => !k.startsWith(`${slug}:`),
                ),
              ),
            }
          : { ...s, recipeSlugs: [...s.recipeSlugs, slug] },
      );
    },
    [],
  );

  const toggleChecked = useCallback((key: string) => {
    setState((s) => ({
      ...s,
      checked: { ...s.checked, [key]: !s.checked[key] },
    }));
  }, []);

  const clearChecked = useCallback(() => {
    setState((s) => ({ ...s, checked: {} }));
  }, []);

  const clearAll = useCallback(() => {
    setState({ recipeSlugs: [], checked: {} });
  }, []);

  const value = useMemo<ShoppingListContextValue>(() => {
    const recipes = state.recipeSlugs
      .map((slug) => RECIPES.find((r) => r.slug === slug))
      .filter((r): r is Recipe => Boolean(r));
    return {
      recipes,
      recipeSlugs: state.recipeSlugs,
      checked: state.checked,
      isInList: (slug: string) => state.recipeSlugs.includes(slug),
      addRecipe,
      removeRecipe,
      toggleRecipe,
      toggleChecked,
      clearChecked,
      clearAll,
      count: state.recipeSlugs.length,
    };
  }, [state, addRecipe, removeRecipe, toggleRecipe, toggleChecked, clearChecked, clearAll]);

  return (
    <ShoppingListContext.Provider value={value}>
      {children}
    </ShoppingListContext.Provider>
  );
}

export function useShoppingList(): ShoppingListContextValue {
  const ctx = useContext(ShoppingListContext);
  if (!ctx) {
    throw new Error('useShoppingList must be used within ShoppingListProvider');
  }
  return ctx;
}
