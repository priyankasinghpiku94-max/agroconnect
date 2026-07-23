import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";

export default function FarmerProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/products/my");
      setProducts(res.data.products || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const deleteProduct = async (id) => {
    if (!window.confirm("Delete this product permanently?")) return;
    try {
      setActionId(id);
      await api.delete(`/products/${id}`);
      await fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete product.");
    } finally {
      setActionId(null);
    }
  };

  const toggleStock = async (product) => {
    const status =
      product.status === "available" ? "paused" : "available";
    try {
      setActionId(product.id);
      await api.put(`/products/${product.id}`, { status });
      await fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update stock status.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <main className="farmer-products-page">
      <div className="farmer-products-container">
        <section className="farmer-products-hero">
          <div>
            <p className="farmer-products-badge">🌾 Farmer Inventory Panel</p>
            <h1>
              My Listed <span>Crops</span>
            </h1>
            <p>
              Edit crop details, maintain accurate available quantity and pause
              listings when stock is not ready for sale.
            </p>
          </div>
          <Link className="btn add-product-top-btn" to="/farmer/add-product">
            Add Product
          </Link>
        </section>

        {error && <div className="alert error farmer-products-alert">{error}</div>}

        {loading ? (
          <div className="farmer-products-loading">
            <div className="loader"></div>
            <p>Loading your products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="empty-products-card">
            <div className="empty-icon">🌱</div>
            <h2>No Products Added Yet</h2>
            <p>Add your first verified crop listing for distributors.</p>
            <Link className="btn" to="/farmer/add-product">
              Add First Product
            </Link>
          </div>
        ) : (
          <section className="farmer-products-section">
            <div className="farmer-products-section-head">
              <div>
                <p>Crop Inventory</p>
                <h2>Product Records</h2>
              </div>
              <span>{products.length} Products</span>
            </div>

            <div className="farmer-products-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Crop</th>
                    <th>Grade</th>
                    <th>Stock / MOQ</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="crop-cell">
                          <div className="crop-thumb">
                            {product.image_url ? (
                              <img src={product.image_url} alt="" />
                            ) : (
                              "🌽"
                            )}
                          </div>
                          <div>
                            <strong>{product.crop_name}</strong>
                            <p>{product.location || "Location not added"}</p>
                          </div>
                        </div>
                      </td>
                      <td>{product.quality_grade || "Standard"}</td>
                      <td>
                        {product.quantity} {product.unit}
                        <small className="stock-minimum">
                          Min: {product.min_order_quantity || 1} {product.unit}
                        </small>
                      </td>
                      <td>
                        <strong className="product-price">
                          ₹{product.price_per_unit}/{product.unit}
                        </strong>
                      </td>
                      <td>
                        <span className={`product-status-badge ${product.status}`}>
                          {String(product.status).replaceAll("_", " ")}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions phase-one-actions">
                          <Link
                            className="btn small secondary"
                            to={`/farmer/products/${product.id}/edit`}
                          >
                            Edit
                          </Link>
                          {!["out_of_stock", "sold"].includes(product.status) && (
                            <button
                              className="btn small secondary"
                              onClick={() => toggleStock(product)}
                              disabled={actionId === product.id}
                            >
                              {product.status === "available" ? "Pause" : "Publish"}
                            </button>
                          )}
                          <button
                            className="btn small danger"
                            onClick={() => deleteProduct(product.id)}
                            disabled={actionId === product.id}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
