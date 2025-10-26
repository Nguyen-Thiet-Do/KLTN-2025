import "../ReaderCard.css";

export default function ReaderCard({ doc }) {
  return (
    <div className="reader-card">
      <img src={doc.coverPhoto || "/no-cover.png"} alt={doc.title} />
      <div className="reader-card-body">
        <h4>{doc.title}</h4>
        <p className="category">{doc.categoryName}</p>
        <p>
          <strong>Cọc:</strong>{" "}
          {doc.minDeposit ? `${doc.minDeposit} - ${doc.maxDeposit}₫` : "—"}
        </p>
        <p>
          <strong>Sẵn có:</strong> {doc.availableCopies}/{doc.totalCopies}
        </p>
      </div>
    </div>
  );
}
