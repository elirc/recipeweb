import { HashRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import { ShoppingListProvider, useShoppingList } from './store/ShoppingListContext';
import HomePage from './pages/HomePage';
import RecipePage from './pages/RecipePage';
import ShoppingListPage from './pages/ShoppingListPage';

function Header() {
  const { count } = useShoppingList();
  return (
    <header className="site-header">
      <div className="container">
        <Link to="/" className="brand">
          <span className="brand-mark">
            Sarap <span className="accent">&amp;</span> Ngon
          </span>
          <span className="brand-sub">Filipino · Vietnamese · Thai · Spanish</span>
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Recipes
          </NavLink>
          <NavLink
            to="/shopping-list"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Shopping list
            {count > 0 && <span className="cart-badge">{count}</span>}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <p>
          Sarap &amp; Ngon — a cookbook companion. Every recipe links to its original
          author's page; ingredient lists are provided for shopping convenience.
          Support the creators by visiting their sites for full instructions.
        </p>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <ShoppingListProvider>
      <HashRouter>
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/recipe/:slug" element={<RecipePage />} />
            <Route path="/shopping-list" element={<ShoppingListPage />} />
          </Routes>
        </main>
        <Footer />
      </HashRouter>
    </ShoppingListProvider>
  );
}
