import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";

export default function FarmerProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/products/my");
      setProducts(res.data.products || []);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          "Failed to load products. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const deleteProduct = async (id) => {
    const confirmDelete = window.confirm("Delete this product?");
    if (!confirmDelete) return;

    try {
      setDeleteLoadingId(id);
      await api.delete(`/products/${id}`);
      fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete product.");
    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <main className="farmer-products-page">
      <div className="farmer-products-container">
        <section className="farmer-products-hero">
          <div>
            <p className="farmer-products-badge">🌾 Farmer Product Panel</p>

            <h1>
              My Listed <span>Crops</span>
            </h1>

            <p>
              Manage your crop listings, check quantity, update stock status and
              remove products that are no longer available.
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
            <p>
              Start by adding your first crop so distributors can find and order
              from you.
            </p>

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
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="crop-cell">
                          <div className="crop-icon">🌽</div>
                          <div>
                            <strong>{p.crop_name || "N/A"}</strong>
                            <p>{p.location || "Location not added"}</p>
                          </div>
                        </div>
                      </td>

                      <td>{p.category || "N/A"}</td>

                      <td>
                        {p.quantity || 0} {p.unit || ""}
                      </td>

                      <td>
                        <strong className="product-price">
                          ₹{p.price_per_unit || 0}/{p.unit || "unit"}
                        </strong>
                      </td>

                      <td>
                        <span className="product-status-badge">
                          {p.status || "active"}
                        </span>
                      </td>

                      <td>
                        <button
                          className="btn small danger"
                          onClick={() => deleteProduct(p.id)}
                          disabled={deleteLoadingId === p.id}
                        >
                          {deleteLoadingId === p.id ? "Deleting..." : "Delete"}
                        </button>
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