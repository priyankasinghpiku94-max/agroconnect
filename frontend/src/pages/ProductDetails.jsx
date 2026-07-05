import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [order, setOrder] = useState({
    quantity: "",
    message: "",
  });

  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [orderLoading, setOrderLoading] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await api.get(`/products/${id}`);
        setProduct(res.data.product);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Failed to load product details."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleOrder = async (e) => {
    e.preventDefault();

    setInfo("");
    setError("");

    if (!user) {
      navigate("/login");
      return;
    }

    if (user.role !== "distributor") {
      setError("Only distributors can place orders.");
      return;
    }

    try {
      setOrderLoading(true);

      await api.post(`/orders/${id}`, order);

      setInfo("Order request sent successfully.");
      setOrder({
        quantity: "",
        message: "",
      });
    } catch (err) {
      setError(err.response?.data?.message || "Order failed");
    } finally {
      setOrderLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="product-details-page">
        <div className="product-details-container">
          <div className="product-details-loading">
            <div className="loader"></div>
            <p>Loading product details...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="product-details-page">
        <div className="product-details-container">
          <div className="product-details-empty">
            <div className="empty-icon">🌱</div>
            <h2>Product Not Found</h2>
            <p>This crop listing is not available right now.</p>
            <button className="btn" onClick={() => navigate("/marketplace")}>
              Back to Marketplace
            </button>
          </div>
        </div>
      </main>
    );
  }

  const location =
    product.location ||
    `${product.district || "N/A"}, ${product.state || ""}`;

  return (
    <main className="product-details-page">
      <div className="product-details-container">
        <section className="product-details-hero">
          <div>
            <p className="product-details-badge">🌾 Crop Details</p>

            <h1>
              Fresh <span>{product.crop_name}</span>
            </h1>

            <p>
              View crop details, farmer information, quantity, price and send an
              order inquiry directly to the farmer.
            </p>
          </div>

          <button
            className="back-marketplace-btn"
            onClick={() => navigate("/marketplace")}
          >
            Back to Marketplace
          </button>
        </section>

        <section className="product-details-layout">
          <div className="product-main-card">
            <div className="product-details-img">
              {product.image_url ? (
                <img src={product.image_url} alt={product.crop_name} />
              ) : (
                <div className="no-image-box">
                  <span>🌱</span>
                  <p>No Image Available</p>
                </div>
              )}
            </div>

            <div className="product-details-content">
              <span className="product-category-badge">
                {product.category || "Crop"}
              </span>

              <h2>{product.crop_name}</h2>

              <p className="product-description">
                {product.description ||
                  "No description added for this product."}
              </p>

              <div className="product-price-box">
                <p>Price Per Unit</p>
                <h3>
                  ₹{product.price_per_unit || 0}/{product.unit || "unit"}
                </h3>
              </div>

              <div className="product-info-grid">
                <div>
                  <span>Available Quantity</span>
                  <strong>
                    {product.quantity || 0} {product.unit || ""}
                  </strong>
                </div>

                <div>
                  <span>Location</span>
                  <strong>{location}</strong>
                </div>

                <div>
                  <span>Farmer</span>
                  <strong>{product.farmer_name || "N/A"}</strong>
                </div>

                <div>
                  <span>Phone</span>
                  <strong>{product.farmer_phone || "N/A"}</strong>
                </div>
              </div>
            </div>
          </div>

          <form className="premium-order-card" onSubmit={handleOrder}>
            <div className="order-card-head">
              <p>Distributor Inquiry</p>
              <h2>Place Order Request</h2>
            </div>

            {info && <div className="alert success">{info}</div>}
            {error && <div className="alert error">{error}</div>}

            <label>Quantity ({product.unit})</label>
            <input
              type="number"
              value={order.quantity}
              onChange={(e) =>
                setOrder({
                  ...order,
                  quantity: e.target.value,
                })
              }
              placeholder={`Enter quantity in ${product.unit}`}
              required
            />

            <label>Message</label>
            <textarea
              value={order.message}
              onChange={(e) =>
                setOrder({
                  ...order,
                  message: e.target.value,
                })
              }
              placeholder="Write your requirement, delivery details or inquiry message..."
            ></textarea>

            <button className="btn full" disabled={orderLoading}>
              {orderLoading ? "Sending..." : "Send Order Request"}
            </button>

            <div className="order-note">
              <span>Note</span>
              <p>
                Only distributors can place orders. Farmers can view product
                details only.
              </p>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}