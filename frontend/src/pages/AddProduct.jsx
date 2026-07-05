import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

export default function AddProduct() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    crop_name: "",
    category: "Vegetables",
    quantity: "",
    unit: "kg",
    price_per_unit: "",
    description: "",
    location: "",
    image_url: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");
    setLoading(true);

    try {
      await api.post("/products", form);

      setMessage("Product added successfully");

      setTimeout(() => {
        navigate("/farmer/products");
      }, 700);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="add-product-page">
      <div className="add-product-container">
        <div className="add-product-left">
          <p className="add-badge">🌾 Farmer Product Panel</p>

          <h1>
            Add Fresh Crop to <span>AgroConnect</span>
          </h1>

          <p>
            Add crop details like quantity, price, location and image URL so
            distributors can discover and place bulk order requests easily.
          </p>

          <div className="add-info-grid">
            <div>
              <h3>Direct Selling</h3>
              <p>No unnecessary middlemen</p>
            </div>

            <div>
              <h3>Better Reach</h3>
              <p>Connect with distributors</p>
            </div>
          </div>

          <div className="preview-card">
            <h3>Product Preview</h3>

            <div className="preview-image">
              {form.image_url ? (
                <img src={form.image_url} alt={form.crop_name || "Crop"} />
              ) : (
                <span>🌱 Image Preview</span>
              )}
            </div>

            <div className="preview-content">
              <p className="preview-category">{form.category}</p>
              <h2>{form.crop_name || "Crop Name"}</h2>
              <p className="preview-price">
                ₹{form.price_per_unit || "0"} / {form.unit || "unit"}
              </p>
              <p className="preview-location">
                📍 {form.location || "Location"}
              </p>
            </div>
          </div>
        </div>

        <form className="add-product-form" onSubmit={handleSubmit}>
          <div className="form-heading">
            <p>Add Product</p>
            <h2>Crop Details</h2>
          </div>

          {message && <div className="alert success">{message}</div>}
          {error && <div className="alert error">{error}</div>}

          <div className="grid two">
            <div>
              <label>Crop Name</label>
              <input
                name="crop_name"
                value={form.crop_name}
                onChange={handleChange}
                placeholder="Example: Fresh Tomato"
                required
              />
            </div>

            <div>
              <label>Category</label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
              >
                <option>Vegetables</option>
                <option>Fruits</option>
                <option>Grains</option>
                <option>Pulses</option>
                <option>Spices</option>
                <option>Other</option>
              </select>
            </div>

            <div>
              <label>Quantity</label>
              <input
                name="quantity"
                type="number"
                value={form.quantity}
                onChange={handleChange}
                placeholder="Example: 100"
                required
              />
            </div>

            <div>
              <label>Unit</label>
              <select name="unit" value={form.unit} onChange={handleChange}>
                <option value="kg">kg</option>
                <option value="quintal">quintal</option>
                <option value="ton">ton</option>
                <option value="box">box</option>
                <option value="piece">piece</option>
              </select>
            </div>

            <div>
              <label>Price Per Unit</label>
              <input
                name="price_per_unit"
                type="number"
                value={form.price_per_unit}
                onChange={handleChange}
                placeholder="Example: 25"
                required
              />
            </div>

            <div>
              <label>Location</label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="Example: Patna, Bihar"
              />
            </div>

            <div className="full-width">
              <label>Image URL</label>
              <input
                name="image_url"
                value={form.image_url}
                onChange={handleChange}
                placeholder="Paste crop image URL"
              />
            </div>

            <div className="full-width">
              <label>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Write crop quality, freshness, harvesting details..."
              ></textarea>
            </div>
          </div>

          <button className="btn full save-product-btn" disabled={loading}>
            {loading ? "Saving..." : "Save Product"}
          </button>
        </form>
      </div>
    </main>
  );
}