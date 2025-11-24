// src/model/index.js
const Account = require('./Account');
const Role = require('./Role');
const Librarian = require('./Librarian');
const Reader = require('./Reader');
const LibraryRule = require('./LibraryRule');
const Category = require('./Category');
const Publisher = require('./Publisher');
const Document = require('./Document');
const Book = require('./Book');
const Magazine = require('./Magazine');
const Newspaper = require('./Newspaper');
const Author = require('./Author');
const DocumentAuthorMap = require('./DocumentAuthorMap');
const Genre = require('./Genre');
const DocumentGenreMap = require('./DocumentGenreMap');
const DocumentCopy = require('./DocumentCopy');
const LoanSlip = require('./LoanSlip');
const LoanDetail = require('./LoanDetail');
const Renewal = require('./Renewal');
const Payment = require('./Payment');
const Violation = require('./Violation');
const Notification = require('./Notification');


const CartItem = require('./CartItem');
const FavoriteItem = require('./FavoriteItem'); 
// NEW: Card models
const CardType = require('./CardType');
const MemberCard = require('./MemberCard');


//


// Accounts & Roles
Role.hasMany(Account, { foreignKey: 'roleId' });
Account.belongsTo(Role, { foreignKey: 'roleId' });

// Librarians / Readers ↔ Accounts & Roles
Account.hasOne(Librarian, { foreignKey: 'accountId' });
Librarian.belongsTo(Account, { foreignKey: 'accountId' });
Role.hasMany(Librarian, { foreignKey: 'roleId' });
Librarian.belongsTo(Role, { foreignKey: 'roleId' });

Account.hasOne(Reader, { foreignKey: 'accountId' });
Reader.belongsTo(Account, { foreignKey: 'accountId' });
Role.hasMany(Reader, { foreignKey: 'roleId' });
Reader.belongsTo(Role, { foreignKey: 'roleId' });

// Library Rules ↔ Account
Account.hasMany(LibraryRule, { foreignKey: 'accountId' });
LibraryRule.belongsTo(Account, { foreignKey: 'accountId' });

// Documents core
Category.hasMany(Document, { foreignKey: 'categoryId' });
Document.belongsTo(Category, { foreignKey: 'categoryId' });

Publisher.hasMany(Document, { foreignKey: 'publisherId' });
Document.belongsTo(Publisher, { foreignKey: 'publisherId' });

// Document types (1–1)
Document.hasOne(Book, { foreignKey: 'documentId', as: 'book' });
Book.belongsTo(Document, { foreignKey: 'documentId' });

Document.hasOne(Magazine, { foreignKey: 'documentId', as: 'magazine' });
Magazine.belongsTo(Document, { foreignKey: 'documentId' });

Document.hasOne(Newspaper, { foreignKey: 'documentId', as: 'newspaper' });
Newspaper.belongsTo(Document, { foreignKey: 'documentId' });

// Authors ↔ Documents (N-N)
Document.belongsToMany(Author, { through: DocumentAuthorMap, foreignKey: 'documentId', otherKey: 'authorId', as: 'authors' });
Author.belongsToMany(Document, { through: DocumentAuthorMap, foreignKey: 'authorId', otherKey: 'documentId', as: 'documents' });

// Genres ↔ Documents (N-N)
Document.belongsToMany(Genre, { through: DocumentGenreMap, foreignKey: 'documentId', otherKey: 'genreId', as: 'genres' });
Genre.belongsToMany(Document, { through: DocumentGenreMap, foreignKey: 'genreId', otherKey: 'documentId', as: 'documents' });

// Document Copies
Document.hasMany(DocumentCopy, { foreignKey: 'documentId', as: 'copies' });
DocumentCopy.belongsTo(Document, { foreignKey: 'documentId' });

// Loans
Reader.hasMany(LoanSlip, { foreignKey: 'readerId' });
LoanSlip.belongsTo(Reader, { foreignKey: 'readerId' });

Librarian.hasMany(LoanSlip, { foreignKey: 'librarianId' });
LoanSlip.belongsTo(Librarian, { foreignKey: 'librarianId' });

LoanSlip.hasMany(LoanDetail, { foreignKey: 'loanSlipId', as: 'details' });
LoanDetail.belongsTo(LoanSlip, { foreignKey: 'loanSlipId' });

DocumentCopy.hasMany(LoanDetail, { foreignKey: 'documentCopyId' });
LoanDetail.belongsTo(DocumentCopy, { foreignKey: 'documentCopyId' });

// Renewals (Renawals)
LoanDetail.hasMany(Renewal, { foreignKey: 'loanDetailId', as: 'renewals' });
Renewal.belongsTo(LoanDetail, { foreignKey: 'loanDetailId' });

Librarian.hasMany(Renewal, { foreignKey: 'librairianId', as: 'approvedRenewals' });
Renewal.belongsTo(Librarian, { foreignKey: 'librairianId' });

// Violations
Reader.hasMany(Violation, { foreignKey: 'readerId' });
Violation.belongsTo(Reader, { foreignKey: 'readerId' });

LoanDetail.hasMany(Violation, { foreignKey: 'loanDetailId' });
Violation.belongsTo(LoanDetail, { foreignKey: 'loanDetailId' });

Librarian.hasMany(Violation, { foreignKey: 'librarianId' });
Violation.belongsTo(Librarian, { foreignKey: 'librarianId' });

// Notifications
Reader.hasMany(Notification, { foreignKey: 'readerId' });
Notification.belongsTo(Reader, { foreignKey: 'readerId' });

// Payments
LoanSlip.hasMany(Payment, { foreignKey: 'loanSlipId' });
Payment.belongsTo(LoanSlip, { foreignKey: 'loanSlipId' });

Violation.hasMany(Payment, { foreignKey: 'violationId' });
Payment.belongsTo(Violation, { foreignKey: 'violationId' });

Reader.hasMany(Payment, { foreignKey: 'readerId' });
Payment.belongsTo(Reader, { foreignKey: 'readerId' });

Librarian.hasMany(Payment, { foreignKey: 'librarianId' });
Payment.belongsTo(Librarian, { foreignKey: 'librarianId' });

// ----------------- Card models relations -----------------
// CardType <-> MemberCard
CardType.hasMany(MemberCard, { foreignKey: 'cardTypeId', as: 'cards' });
MemberCard.belongsTo(CardType, { foreignKey: 'cardTypeId', as: 'cardType' });

// Reader <-> MemberCard (1:1 in your design)
Reader.hasOne(MemberCard, { foreignKey: 'readerId', as: 'memberCard' });
MemberCard.belongsTo(Reader, { foreignKey: 'readerId', as: 'reader' });


// CART ITEMS
Reader.hasMany(CartItem, { foreignKey: 'readerId', as: 'cartItems' });
CartItem.belongsTo(Reader, { foreignKey: 'readerId' });

Document.hasMany(CartItem, { foreignKey: 'documentId', as: 'cartDocuments' });
CartItem.belongsTo(Document, { foreignKey: 'documentId' });

// FAVORITE ITEMS
Reader.hasMany(FavoriteItem, { foreignKey: 'readerId', as: 'favoriteItems' });
FavoriteItem.belongsTo(Reader, { foreignKey: 'readerId' });

Document.hasMany(FavoriteItem, { foreignKey: 'documentId', as: 'favoriteDocuments' });
FavoriteItem.belongsTo(Document, { foreignKey: 'documentId' });


module.exports = {
  Account,
  Role,
  Librarian,
  Reader,
  LibraryRule,
  Category,
  Publisher,
  Document,
  Book,
  Magazine,
  Newspaper,
  Author,
  DocumentAuthorMap,
  Genre,
  DocumentGenreMap,
  DocumentCopy,
  LoanSlip,
  LoanDetail,
  Renewal,
  Payment,
  Violation,
  Notification,
  CardType,
  MemberCard,
  CartItem,
  FavoriteItem,
};
