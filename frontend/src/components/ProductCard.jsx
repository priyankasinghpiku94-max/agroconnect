import { Link } from "react-router-dom";
import VerificationBadge from "./VerificationBadge";

export default function ProductCard({ product }) {
  return (
    <div className="product-card">
      <div className="product-image">
        {product?.image_url ? (
          <img src={product.image_url} alt={product.crop_name} />
        ) : (
          <span>No Image</span>
        )}
      </div>

      <div className="card-body">
        <div className="product-card-badges">
          <span className="badge">{product?.category}</span>
          {product?.farmer_verified && <VerificationBadge status="verified" />}
        </div>

        <h3>{product?.crop_name}</h3>
        <p>{product?.description || "Fresh agricultural produce listed by a verified farmer."}</p>

        <div className="price">₹{product?.price_per_unit}/{product?.unit}</div>
        <p className="product-meta">Available: {product?.quantity} {product?.unit}</p>
        <p className="product-meta">MOQ: {product?.min_order_quantity || 1} {product?.unit} · Grade {product?.quality_grade || "Standard"}</p>
        <p className="product-meta">Location: {product?.location}</p>
        <p className="product-meta">Farmer: {product?.farmer_name || "Verified Farmer"}</p>

        <div className="product-actions">
          <Link className="btn small view-btn" to={`/products/${product.id}`}>View Details</Link>
          <Link className="btn small order-btn" to={`/products/${product.id}`}>Request Order</Link>
        </div>
      </div>
    </div>
  );
}
