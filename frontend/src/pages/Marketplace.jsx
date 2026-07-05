import { useEffect, useState } from "react";
import api from "../api/api";
import ProductCard from "../components/ProductCard";

export default function Marketplace() {
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    district: "",
    state: "",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value.trim()) {
          params.append(key, value.trim());
        }
      });

      const res = await api.get(`/products?${params.toString()}`);
      setProducts(res.data.products || []);
    } catch (err) {
  console.error("Marketplace API Error:", err);

  setError(
    err.response?.data?.message ||
      err.message ||
      "Failed to load marketplace products. Please try again."
  );
}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value,
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchProducts();
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      category: "",
      district: "",
      state: "",
    });

    setTimeout(() => {
      fetchProducts();
    }, 100);
  };

  return (
    <main className="marketplace-page">
      <div className="marketplace-container">
        <section className="marketplace-hero">
          <div>
            <p className="marketplace-badge">🌾 AgroConnect Marketplace</p>

            <h1>
              Explore Fresh Crops <span>Directly From Farmers</span>
            </h1>

            <p>
              Search fresh agricultural products by crop name, category,
              district and state. Connect directly with farmers and place bulk
              order requests.
            </p>
          </div>

          <div className="marketplace-mini-card">
            <h3>{products.length}</h3>
            <p>Available Products</p>
          </div>
        </section>

        <form className="premium-filter-card" onSubmit={handleSearch}>
          <div>
            <label>Search Crop</label>
            <input
              name="search"
              placeholder="Search crop name"
              value={filters.search}
              onChange={handleChange}
            />
          </div>

          <div>
            <label>Category</label>
            <select
              name="category"
              value={filters.category}
              onChange={handleChange}
            >
              <option value="">All Categories</option>
              <option>Vegetables</option>
              <option>Fruits</option>
              <option>Grains</option>
              <option>Pulses</option>
              <option>Spices</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label>District</label>
            <input
              name="district"
              placeholder="Enter district"
              value={filters.district}
              onChange={handleChange}
            />
          </div>

          <div>
            <label>State</label>
            <input
              name="state"
              placeholder="Enter state"
              value={filters.state}
              onChange={handleChange}
            />
          </div>

          <div className="filter-actions">
            <button className="btn search-btn" type="submit">
              Search
            </button>

            <button
              className="clear-filter-btn"
              type="button"
              onClick={clearFilters}
            >
              Clear
            </button>
          </div>
        </form>

        {error && <div className="alert error marketplace-alert">{error}</div>}

        {loading ? (
          <div className="marketplace-loading">
            <div className="loader"></div>
            <p>Loading fresh crops...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="marketplace-empty">
            <div className="empty-icon">🌱</div>
            <h2>No Products Found</h2>
            <p>
              Try changing your search, category, district or state filters.
            </p>
          </div>
        ) : (
          <section className="marketplace-products-section">
            <div className="marketplace-section-head">
              <div>
                <p>Available Listings</p>
                <h2>Fresh Crop Products</h2>
              </div>

              <span>{products.length} Results</span>
            </div>

            <div className="marketplace-products-grid">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}