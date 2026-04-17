import { AppError } from "../../shared/errors/app-error";
import { collapseWhitespace } from "../../shared/utils/strings";
import { SuppliersRepository } from "./suppliers.repository";
import type {
  CreateSupplierInput,
  ListSuppliersQuery,
  UpdateSupplierInput,
  UpdateSupplierStatusInput,
} from "./suppliers.validation";

const buildAppError = (statusCode: number, code: string, message: string) =>
  new AppError({
    statusCode,
    code,
    message,
  });

const normalizeSearchValue = (value: string) =>
  collapseWhitespace(value).toLowerCase();

const buildPaginatedResponse = <T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
) => ({
  items,
  pagination: {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  },
});

const toSupplierResponse = (supplier: {
  id: string;
  shopId: string;
  supplierName: string;
  companyName: string | null;
  contactPerson: string | null;
  mobileNumber: string;
  alternateMobileNumber: string | null;
  email: string | null;
  gstNumber: string | null;
  drugLicenseNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  openingBalance: string;
  notes: string | null;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: supplier.id,
  shopId: supplier.shopId,
  supplierName: supplier.supplierName,
  companyName: supplier.companyName,
  contactPerson: supplier.contactPerson,
  mobileNumber: supplier.mobileNumber,
  alternateMobileNumber: supplier.alternateMobileNumber,
  email: supplier.email,
  gstNumber: supplier.gstNumber,
  drugLicenseNumber: supplier.drugLicenseNumber,
  addressLine1: supplier.addressLine1,
  addressLine2: supplier.addressLine2,
  city: supplier.city,
  state: supplier.state,
  pincode: supplier.pincode,
  openingBalance: supplier.openingBalance,
  notes: supplier.notes,
  status: supplier.status,
  createdAt: supplier.createdAt,
  updatedAt: supplier.updatedAt,
});

export class SuppliersService {
  constructor(private readonly suppliersRepository = new SuppliersRepository()) {}

  async listSuppliers(shopId: string, query: ListSuppliersQuery) {
    const normalizedQuery = {
      ...query,
      search: query.search ? normalizeSearchValue(query.search) : undefined,
    };
    const [items, total] = await Promise.all([
      this.suppliersRepository.listSuppliers(shopId, normalizedQuery),
      this.suppliersRepository.countSuppliers(shopId, normalizedQuery),
    ]);

    return buildPaginatedResponse(
      items.map((item) =>
        toSupplierResponse({
          ...item,
          openingBalance: item.openingBalance,
        }),
      ),
      total,
      normalizedQuery.page,
      normalizedQuery.pageSize,
    );
  }

  async getSupplierById(shopId: string, supplierId: string) {
    const supplier = await this.suppliersRepository.findSupplierById(
      shopId,
      supplierId,
    );

    if (!supplier) {
      throw buildAppError(404, "SUPPLIER_NOT_FOUND", "Supplier not found.");
    }

    return toSupplierResponse({
      ...supplier,
      openingBalance: supplier.openingBalance,
    });
  }

  async createSupplier(shopId: string, input: CreateSupplierInput) {
    const supplierNameNormalized = normalizeSearchValue(input.supplierName);
    const companyNameNormalized = input.companyName
      ? normalizeSearchValue(input.companyName)
      : undefined;

    const mobileDuplicate = await this.suppliersRepository.findSupplierByMobile(
      shopId,
      input.mobileNumber,
    );

    if (mobileDuplicate) {
      throw buildAppError(
        409,
        "SUPPLIER_MOBILE_CONFLICT",
        "Another supplier already uses this mobile number.",
      );
    }

    if (input.email) {
      const emailDuplicate = await this.suppliersRepository.findSupplierByEmail(
        shopId,
        input.email,
      );

      if (emailDuplicate) {
        throw buildAppError(
          409,
          "SUPPLIER_EMAIL_CONFLICT",
          "Another supplier already uses this email address.",
        );
      }
    }

    if (input.gstNumber) {
      const gstDuplicate = await this.suppliersRepository.findSupplierByGst(
        shopId,
        input.gstNumber,
      );

      if (gstDuplicate) {
        throw buildAppError(
          409,
          "SUPPLIER_GST_CONFLICT",
          "Another supplier already uses this GST number.",
        );
      }
    }

    const createdSupplier = await this.suppliersRepository.createSupplier({
      shopId,
      supplierName: input.supplierName,
      supplierNameNormalized,
      companyName: input.companyName,
      companyNameNormalized,
      contactPerson: input.contactPerson,
      mobileNumber: input.mobileNumber,
      alternateMobileNumber: input.alternateMobileNumber,
      email: input.email,
      gstNumber: input.gstNumber,
      drugLicenseNumber: input.drugLicenseNumber,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      openingBalance: input.openingBalance,
      notes: input.notes,
      status: input.status,
    });

    if (!createdSupplier) {
      throw buildAppError(
        500,
        "SUPPLIER_CREATE_FAILED",
        "Failed to create supplier.",
      );
    }

    return this.getSupplierById(shopId, createdSupplier.id);
  }

  async updateSupplier(
    shopId: string,
    supplierId: string,
    input: UpdateSupplierInput,
  ) {
    const existingSupplier = await this.suppliersRepository.findSupplierById(
      shopId,
      supplierId,
    );

    if (!existingSupplier) {
      throw buildAppError(404, "SUPPLIER_NOT_FOUND", "Supplier not found.");
    }

    const nextMobileNumber = input.mobileNumber ?? existingSupplier.mobileNumber;
    const nextEmail =
      input.email !== undefined ? input.email : existingSupplier.email ?? undefined;
    const nextGstNumber =
      input.gstNumber !== undefined
        ? input.gstNumber
        : existingSupplier.gstNumber ?? undefined;

    const mobileDuplicate = await this.suppliersRepository.findSupplierByMobile(
      shopId,
      nextMobileNumber,
      supplierId,
    );

    if (mobileDuplicate) {
      throw buildAppError(
        409,
        "SUPPLIER_MOBILE_CONFLICT",
        "Another supplier already uses this mobile number.",
      );
    }

    if (nextEmail) {
      const emailDuplicate = await this.suppliersRepository.findSupplierByEmail(
        shopId,
        nextEmail,
        supplierId,
      );

      if (emailDuplicate) {
        throw buildAppError(
          409,
          "SUPPLIER_EMAIL_CONFLICT",
          "Another supplier already uses this email address.",
        );
      }
    }

    if (nextGstNumber) {
      const gstDuplicate = await this.suppliersRepository.findSupplierByGst(
        shopId,
        nextGstNumber,
        supplierId,
      );

      if (gstDuplicate) {
        throw buildAppError(
          409,
          "SUPPLIER_GST_CONFLICT",
          "Another supplier already uses this GST number.",
        );
      }
    }

    const updatedSupplier = await this.suppliersRepository.updateSupplier(
      supplierId,
      {
        ...(input.supplierName !== undefined
          ? {
              supplierName: input.supplierName,
              supplierNameNormalized: normalizeSearchValue(input.supplierName),
            }
          : {}),
        ...(input.companyName !== undefined
          ? {
              companyName: input.companyName,
              companyNameNormalized: input.companyName
                ? normalizeSearchValue(input.companyName)
                : null,
            }
          : {}),
        ...(input.contactPerson !== undefined
          ? { contactPerson: input.contactPerson }
          : {}),
        ...(input.mobileNumber !== undefined
          ? { mobileNumber: input.mobileNumber }
          : {}),
        ...(input.alternateMobileNumber !== undefined
          ? { alternateMobileNumber: input.alternateMobileNumber }
          : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.gstNumber !== undefined ? { gstNumber: input.gstNumber } : {}),
        ...(input.drugLicenseNumber !== undefined
          ? { drugLicenseNumber: input.drugLicenseNumber }
          : {}),
        ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
        ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
        ...(input.pincode !== undefined ? { pincode: input.pincode } : {}),
        ...(input.openingBalance !== undefined
          ? { openingBalance: input.openingBalance }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    );

    if (!updatedSupplier) {
      throw buildAppError(
        500,
        "SUPPLIER_UPDATE_FAILED",
        "Failed to update supplier.",
      );
    }

    return this.getSupplierById(shopId, supplierId);
  }

  async updateSupplierStatus(
    shopId: string,
    supplierId: string,
    input: UpdateSupplierStatusInput,
  ) {
    const supplier = await this.suppliersRepository.findSupplierById(
      shopId,
      supplierId,
    );

    if (!supplier) {
      throw buildAppError(404, "SUPPLIER_NOT_FOUND", "Supplier not found.");
    }

    const updatedSupplier = await this.suppliersRepository.updateSupplierStatus(
      supplierId,
      input.status,
    );

    if (!updatedSupplier) {
      throw buildAppError(
        500,
        "SUPPLIER_STATUS_UPDATE_FAILED",
        "Failed to update supplier status.",
      );
    }

    return this.getSupplierById(shopId, supplierId);
  }
}
