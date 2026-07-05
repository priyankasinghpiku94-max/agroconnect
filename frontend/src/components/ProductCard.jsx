import { Link } from "react-router-dom";

export default function ProductCard({ product }) {
  const phone = product?.farmer_phone || "9835804351";
  const cleanPhone = phone.replace(/\D/g, "");
  const whatsappPhone = cleanPhone.startsWith("91")
    ? cleanPhone
    : `91${cleanPhone}`;

  const whatsappMessage = encodeURIComponent(
    `Hello, I am interested in your product: ${product?.crop_name}. Price: ₹${product?.price_per_unit}/${product?.unit}. Location: ${product?.location}`
  );

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
        <span className="badge">{product?.category}</span>

        <h3>{product?.crop_name}</h3>

        <p>{product?.description}</p>

        <div className="price">
          ₹{product?.price_per_unit}/{product?.unit}
        </div>

        <p className="product-meta">
          Available: {product?.quantity} {product?.unit}
        </p>

        <p className="product-meta">Location: {product?.location}</p>

        <p className="product-meta">
          Farmer: {product?.farmer_name || "N/A"}
        </p>

        <div className="product-actions">
          <Link className="btn small view-btn" to={`/products/${product.id}`}>
            View
          </Link>

          <Link className="btn small order-btn" to={`/products/${product.id}`}>
            Order
          </Link>

          {phone ? (
            <a className="btn small call-btn" href={`tel:${phone}`}>
              Call
            </a>
          ) : (
            <button className="btn small call-btn" disabled>
              Call
            </button>
          )}

          {phone ? (
            <a
              className="btn small whatsapp-btn"
              href={`https://wa.me/${whatsappPhone}?text=${whatsappMessage}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          ) : (
            <button className="btn small whatsapp-btn" disabled>
              WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  );
}