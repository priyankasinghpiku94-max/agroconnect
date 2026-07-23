import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/api";

const initialForm = {
  crop_name: "",
  category: "Vegetables",
  quantity: "",
  unit: "kg",
  price_per_unit: "",
  min_order_quantity: "1",
  quality_grade: "Standard",
  harvest_date: "",
  description: "",
  location: "",
  status: "available",
};

export default function AddProduct() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const [form, setForm] = useState(initialForm);
  const [image, setImage] = useState(null);
  const [currentImage, setCurrentImage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(editing);

  const previewUrl = useMemo(
    () => (image ? URL.createObjectURL(image) : currentImage),
    [image, currentImage]
  );

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!editing) return;

    const loadProduct = async () => {
      try {
        const res = await api.get("/products/my");
        const product = (res.data.products || []).find(
          (item) => Number(item.id) === Number(id)
        );
        if (!product) throw new Error("Product not found in your inventory");
        setForm({
          crop_name: product.crop_name || "",
          category: product.category || "Vegetables",
          quantity: product.quantity ?? "",
          unit: product.unit || "kg",
          price_per_unit: product.price_per_unit ?? "",
          min_order_quantity: product.min_order_quantity ?? "1",
          quality_grade: product.quality_grade || "Standard",
          harvest_date: product.harvest_date
            ? String(product.harvest_date).slice(0, 10)
            : "",
          description: product.description || "",
          location: product.location || "",
          status: product.status || "available",
        });
        setCurrentImage(product.image_url || "");
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to load product"
        );
      } finally {
        setPageLoading(false);
      }
    };

    loadProduct();
  }, [editing, id]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    setError("");
    if (!file) return setImage(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      e.target.value = "";
      return setError("Please select a JPG, PNG or WebP image.");
    }
    if (file.size > 5 * 1024 * 1024) {
      e.target.value = "";
      return setError("Product image must be smaller than 5 MB.");
    }
    setImage(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (Number(form.min_order_quantity) > Number(form.quantity)) {
      setError("Minimum order quantity cannot exceed available stock.");
      return;
    }

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, value));
    if (image) payload.append("image", image);

    try {
      setLoading(true);
      if (editing) await api.put(`/products/${id}`, payload);
      else await api.post("/products", payload);
      setMessage(editing ? "Product updated successfully." : "Product added successfully.");
      setTimeout(() => navigate("/farmer/products"), 500);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save product");
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <main className="add-product-page">
        <div className="farmer-products-loading">
          <div className="loader"></div>
          <p>Loading product...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="add-product-page">
      <div className="add-product-container">
        <div className="add-product-left">
          <p className="add-badge">🌾 Farmer Inventory Panel</p>
          <h1>
            {editing ? "Update" : "Add"} Fresh Crop on <span>AgroConnect</span>
          </h1>
          <p>
            Maintain accurate stock, quality, minimum order quantity and a real
            crop image so verified distributors can place reliable orders.
          </p>

          <div className="preview-card">
            <h3>Product Preview</h3>
            <div className="preview-image">
              {previewUrl ? (
                <img src={previewUrl} alt={form.crop_name || "Crop preview"} />
              ) : (
                <span>🌱 Image Preview</span>
              )}
            </div>
            <div className="preview-content">
              <p className="preview-category">
                {form.category} · Grade {form.quality_grade}
              </p>
              <h2>{form.crop_name || "Crop Name"}</h2>
              <p className="preview-price">
                ₹{form.price_per_unit || "0"} / {form.unit}
              </p>
              <p className="preview-location">
                📍 {form.location || "Location"}
              </p>
            </div>
          </div>
        </div>

        <form className="add-product-form" onSubmit={handleSubmit}>
          <div className="form-heading">
            <p>{editing ? "Edit Product" : "Add Product"}</p>
            <h2>Crop and Stock Details</h2>
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
                maxLength="120"
                required
              />
            </div>
            <div>
              <label>Category</label>
              <select name="category" value={form.category} onChange={handleChange}>
                <option>Vegetables</option>
                <option>Fruits</option>
                <option>Grains</option>
                <option>Pulses</option>
                <option>Spices</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label>Available Quantity</label>
              <input
                name="quantity"
                type="number"
                min="0"
                step="0.01"
                value={form.quantity}
                onChange={handleChange}
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
                min="0"
                step="0.01"
                value={form.price_per_unit}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label>Minimum Order Quantity</label>
              <input
                name="min_order_quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={form.min_order_quantity}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label>Quality Grade</label>
              <select
                name="quality_grade"
                value={form.quality_grade}
                onChange={handleChange}
              >
                <option value="Standard">Standard</option>
                <option value="A">Grade A</option>
                <option value="B">Grade B</option>
                <option value="C">Grade C</option>
              </select>
            </div>
            <div>
              <label>Harvest Date</label>
              <input
                name="harvest_date"
                type="date"
                value={form.harvest_date}
                onChange={handleChange}
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
            <div>
              <label>Stock Status</label>
              <select name="status" value={form.status} onChange={handleChange}>
                <option value="available">Available</option>
                <option value="out_of_stock">Out of stock</option>
                <option value="paused">Paused</option>
                <option value="sold">Sold</option>
              </select>
            </div>
            <div className="full-width">
              <label>Product Image (JPG, PNG or WebP; maximum 5 MB)</label>
              <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleImage} />
              {editing && currentImage && !image && (
                <small className="form-help">Current image will be retained.</small>
              )}
            </div>
            <div className="full-width">
              <label>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                maxLength="3000"
                placeholder="Add crop quality, freshness and packaging details..."
              ></textarea>
            </div>
          </div>

          <button className="btn full save-product-btn" disabled={loading}>
            {loading ? "Saving..." : editing ? "Update Product" : "Save Product"}
          </button>
        </form>
      </div>
    </main>
  );
}
