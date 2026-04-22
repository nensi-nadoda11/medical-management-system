import { AppError } from "../../shared/errors/app-error";
import { collapseWhitespace } from "../../shared/utils/strings";
import { MedicinesRepository } from "./medicines.repository";
import type {
  CreateCategoryInput,
  CreateManufacturerInput,
  CreateMedicineInput,
  ListMasterDataQuery,
  ListMedicinesQuery,
  UpdateCategoryInput,
  UpdateManufacturerInput,
  UpdateMedicineInput,
  UpdateMedicineStatusInput,
} from "./medicines.validation";

const buildAppError = (statusCode: number, code: string, message: string) =>
  new AppError({
    statusCode,
    code,
    message,
  });

const normalizeSearchValue = (value: string) =>
  collapseWhitespace(value).toLowerCase();

const toOptionalNormalizedValue = (value?: string) =>
  value ? normalizeSearchValue(value) : "";

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

const toCategoryResponse = (category: {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: category.id,
  shopId: category.shopId,
  name: category.name,
  description: category.description,
  status: category.status,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
});

const toManufacturerResponse = (manufacturer: {
  id: string;
  shopId: string;
  name: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: manufacturer.id,
  shopId: manufacturer.shopId,
  name: manufacturer.name,
  status: manufacturer.status,
  createdAt: manufacturer.createdAt,
  updatedAt: manufacturer.updatedAt,
});

const toMedicineResponse = (record: {
  medicine: {
    id: string;
    shopId: string;
    medicineName: string;
    genericName: string;
    brandName: string | null;
    strength: string | null;
    form: string;
    unit: string;
    hsnCode: string | null;
    gstPercent: number;
    barcode: string | null;
    reorderLevel: number;
    prescriptionRequired: boolean;
    notes: string | null;
    status: "active" | "inactive";
    createdAt: Date;
    updatedAt: Date;
  };
  category: {
    id: string;
    name: string;
    status: "active" | "inactive";
  };
  manufacturer: {
    id: string;
    name: string;
    status: "active" | "inactive";
  };
}) => ({
  id: record.medicine.id,
  shopId: record.medicine.shopId,
  medicineName: record.medicine.medicineName,
  genericName: record.medicine.genericName,
  brandName: record.medicine.brandName,
  strength: record.medicine.strength,
  form: record.medicine.form,
  unit: record.medicine.unit,
  category: record.category,
  manufacturer: record.manufacturer,
  hsnCode: record.medicine.hsnCode,
  gstPercent: record.medicine.gstPercent,
  barcode: record.medicine.barcode,
  reorderLevel: record.medicine.reorderLevel,
  prescriptionRequired: record.medicine.prescriptionRequired,
  notes: record.medicine.notes,
  status: record.medicine.status,
  createdAt: record.medicine.createdAt,
  updatedAt: record.medicine.updatedAt,
});

export class MedicinesService {
  constructor(private readonly medicinesRepository = new MedicinesRepository()) {}

  async listCategories(shopId: string, query: ListMasterDataQuery) {
    const normalizedQuery = {
      ...query,
      search: query.search ? normalizeSearchValue(query.search) : undefined,
    };

    const [items, total] = await Promise.all([
      this.medicinesRepository.listCategories(shopId, normalizedQuery),
      this.medicinesRepository.countCategories(shopId, normalizedQuery),
    ]);

    return buildPaginatedResponse(
      items.map(toCategoryResponse),
      total,
      normalizedQuery.page,
      normalizedQuery.pageSize,
    );
  }

  async createCategory(shopId: string, input: CreateCategoryInput) {
    const normalizedName = normalizeSearchValue(input.name);
    const duplicate = await this.medicinesRepository.findCategoryByNormalizedName(
      shopId,
      normalizedName,
    );

    if (duplicate) {
      throw buildAppError(
        409,
        "CATEGORY_ALREADY_EXISTS",
        "A category with this name already exists.",
      );
    }

    const category = await this.medicinesRepository.createCategory({
      shopId,
      name: input.name,
      normalizedName,
      ...(input.description !== undefined ? { description: input.description } : {}),
      status: input.status,
    });

    if (!category) {
      throw buildAppError(
        500,
        "CATEGORY_CREATE_FAILED",
        "Failed to create category.",
      );
    }

    return toCategoryResponse(category);
  }

  async updateCategory(
    shopId: string,
    categoryId: string,
    input: UpdateCategoryInput,
  ) {
    const category = await this.medicinesRepository.findCategoryById(
      shopId,
      categoryId,
    );

    if (!category) {
      throw buildAppError(404, "CATEGORY_NOT_FOUND", "Category not found.");
    }

    const nextName = input.name ?? category.name;
    const normalizedName = normalizeSearchValue(nextName);
    const duplicate = await this.medicinesRepository.findCategoryByNormalizedName(
      shopId,
      normalizedName,
      categoryId,
    );

    if (duplicate) {
      throw buildAppError(
        409,
        "CATEGORY_ALREADY_EXISTS",
        "A category with this name already exists.",
      );
    }

    const updatedCategory = await this.medicinesRepository.updateCategory(
      categoryId,
      {
        ...(input.name !== undefined ? { name: input.name, normalizedName } : {}),
        ...(input.description !== undefined
          ? { description: input.description ?? null }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    );

    if (!updatedCategory) {
      throw buildAppError(
        500,
        "CATEGORY_UPDATE_FAILED",
        "Failed to update category.",
      );
    }

    return toCategoryResponse(updatedCategory);
  }

  async deleteCategory(shopId: string, categoryId: string) {
    const category = await this.medicinesRepository.findCategoryById(
      shopId,
      categoryId,
    );

    if (!category) {
      throw buildAppError(404, "CATEGORY_NOT_FOUND", "Category not found.");
    }

    // Check if any medicines are using this category
    const count = await this.medicinesRepository.countMedicines(shopId, {
      categoryId,
      page: 1,
      pageSize: 1,
      sortBy: "medicineName",
      sortOrder: "asc",
    });

    if (Number(count) > 0) {
      throw buildAppError(
        400,
        "CATEGORY_IN_USE",
        "Cannot delete category because it is being used by one or more medicines.",
      );
    }

    const deleted = await this.medicinesRepository.deleteCategory(
      shopId,
      categoryId,
    );

    if (!deleted) {
      throw buildAppError(
        500,
        "CATEGORY_DELETE_FAILED",
        "Failed to delete category.",
      );
    }

    return { id: categoryId, success: true };
  }

  async listManufacturers(shopId: string, query: ListMasterDataQuery) {
    const normalizedQuery = {
      ...query,
      search: query.search ? normalizeSearchValue(query.search) : undefined,
    };

    const [items, total] = await Promise.all([
      this.medicinesRepository.listManufacturers(shopId, normalizedQuery),
      this.medicinesRepository.countManufacturers(shopId, normalizedQuery),
    ]);

    return buildPaginatedResponse(
      items.map(toManufacturerResponse),
      total,
      normalizedQuery.page,
      normalizedQuery.pageSize,
    );
  }

  async createManufacturer(shopId: string, input: CreateManufacturerInput) {
    const normalizedName = normalizeSearchValue(input.name);
    const duplicate =
      await this.medicinesRepository.findManufacturerByNormalizedName(
        shopId,
        normalizedName,
      );

    if (duplicate) {
      throw buildAppError(
        409,
        "MANUFACTURER_ALREADY_EXISTS",
        "A manufacturer with this name already exists.",
      );
    }

    const manufacturer = await this.medicinesRepository.createManufacturer({
      shopId,
      name: input.name,
      normalizedName,
      status: input.status,
    });

    if (!manufacturer) {
      throw buildAppError(
        500,
        "MANUFACTURER_CREATE_FAILED",
        "Failed to create manufacturer.",
      );
    }

    return toManufacturerResponse(manufacturer);
  }

  async updateManufacturer(
    shopId: string,
    manufacturerId: string,
    input: UpdateManufacturerInput,
  ) {
    const manufacturer = await this.medicinesRepository.findManufacturerById(
      shopId,
      manufacturerId,
    );

    if (!manufacturer) {
      throw buildAppError(
        404,
        "MANUFACTURER_NOT_FOUND",
        "Manufacturer not found.",
      );
    }

    const nextName = input.name ?? manufacturer.name;
    const normalizedName = normalizeSearchValue(nextName);
    const duplicate =
      await this.medicinesRepository.findManufacturerByNormalizedName(
        shopId,
        normalizedName,
        manufacturerId,
      );

    if (duplicate) {
      throw buildAppError(
        409,
        "MANUFACTURER_ALREADY_EXISTS",
        "A manufacturer with this name already exists.",
      );
    }

    const updatedManufacturer =
      await this.medicinesRepository.updateManufacturer(manufacturerId, {
        ...(input.name !== undefined ? { name: input.name, normalizedName } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      });

    if (!updatedManufacturer) {
      throw buildAppError(
        500,
        "MANUFACTURER_UPDATE_FAILED",
        "Failed to update manufacturer.",
      );
    }

    return toManufacturerResponse(updatedManufacturer);
  }

  async deleteManufacturer(shopId: string, manufacturerId: string) {
    const manufacturer = await this.medicinesRepository.findManufacturerById(
      shopId,
      manufacturerId,
    );

    if (!manufacturer) {
      throw buildAppError(
        404,
        "MANUFACTURER_NOT_FOUND",
        "Manufacturer not found.",
      );
    }

    // Check if any medicines are using this manufacturer
    const count = await this.medicinesRepository.countMedicines(shopId, {
      manufacturerId,
      page: 1,
      pageSize: 1,
      sortBy: "medicineName",
      sortOrder: "asc",
    });

    if (Number(count) > 0) {
      throw buildAppError(
        400,
        "MANUFACTURER_IN_USE",
        "Cannot delete manufacturer because it is being used by one or more medicines.",
      );
    }

    const deleted = await this.medicinesRepository.deleteManufacturer(
      shopId,
      manufacturerId,
    );

    if (!deleted) {
      throw buildAppError(
        500,
        "MANUFACTURER_DELETE_FAILED",
        "Failed to delete manufacturer.",
      );
    }

    return { id: manufacturerId, success: true };
  }

  async listMedicines(shopId: string, query: ListMedicinesQuery) {
    const normalizedQuery = {
      ...query,
      search: query.search ? normalizeSearchValue(query.search) : undefined,
    };

    const [items, total] = await Promise.all([
      this.medicinesRepository.listMedicines(shopId, normalizedQuery),
      this.medicinesRepository.countMedicines(shopId, normalizedQuery),
    ]);

    return buildPaginatedResponse(
      items.map(toMedicineResponse),
      total,
      normalizedQuery.page,
      normalizedQuery.pageSize,
    );
  }

  async getMedicineById(shopId: string, medicineId: string) {
    const medicine = await this.medicinesRepository.findMedicineById(
      shopId,
      medicineId,
    );

    if (!medicine) {
      throw buildAppError(404, "MEDICINE_NOT_FOUND", "Medicine not found.");
    }

    return toMedicineResponse(medicine);
  }

  async createMedicine(shopId: string, input: CreateMedicineInput) {
    const category = await this.medicinesRepository.findCategoryById(
      shopId,
      input.categoryId,
    );

    if (!category) {
      throw buildAppError(404, "CATEGORY_NOT_FOUND", "Category not found.");
    }

    if (category.status !== "active") {
      throw buildAppError(
        400,
        "CATEGORY_INACTIVE",
        "Only active categories can be used for medicines.",
      );
    }

    const manufacturer = await this.medicinesRepository.findManufacturerById(
      shopId,
      input.manufacturerId,
    );

    if (!manufacturer) {
      throw buildAppError(
        404,
        "MANUFACTURER_NOT_FOUND",
        "Manufacturer not found.",
      );
    }

    if (manufacturer.status !== "active") {
      throw buildAppError(
        400,
        "MANUFACTURER_INACTIVE",
        "Only active manufacturers can be used for medicines.",
      );
    }

    const medicineNameNormalized = normalizeSearchValue(input.medicineName);
    const genericNameNormalized = normalizeSearchValue(input.genericName);
    const brandNameNormalized = input.brandName
      ? normalizeSearchValue(input.brandName)
      : undefined;
    const strengthNormalized = toOptionalNormalizedValue(input.strength);

    const duplicate = await this.medicinesRepository.findMedicineDuplicate(
      shopId,
      {
        medicineNameNormalized,
        strengthNormalized,
        form: input.form,
        manufacturerId: input.manufacturerId,
      },
    );

    if (duplicate) {
      throw buildAppError(
        409,
        "MEDICINE_ALREADY_EXISTS",
        "A medicine with the same name, strength, form, and manufacturer already exists.",
      );
    }

    if (input.barcode) {
      const barcodeDuplicate = await this.medicinesRepository.findMedicineByBarcode(
        shopId,
        input.barcode,
      );

      if (barcodeDuplicate) {
        throw buildAppError(
          409,
          "MEDICINE_BARCODE_CONFLICT",
          "Another medicine already uses this barcode.",
        );
      }
    }

    const createdMedicine = await this.medicinesRepository.createMedicine({
      shopId,
      medicineName: input.medicineName,
      medicineNameNormalized,
      genericName: input.genericName,
      genericNameNormalized,
      brandName: input.brandName,
      brandNameNormalized,
      strength: input.strength,
      strengthNormalized,
      form: input.form,
      unit: input.unit,
      categoryId: input.categoryId,
      manufacturerId: input.manufacturerId,
      hsnCode: input.hsnCode,
      gstPercent: input.gstPercent,
      barcode: input.barcode,
      reorderLevel: input.reorderLevel,
      prescriptionRequired: input.prescriptionRequired,
      notes: input.notes,
      status: input.status,
    });

    if (!createdMedicine) {
      throw buildAppError(
        500,
        "MEDICINE_CREATE_FAILED",
        "Failed to create medicine.",
      );
    }

    return this.getMedicineById(shopId, createdMedicine.id);
  }

  async updateMedicine(
    shopId: string,
    medicineId: string,
    input: UpdateMedicineInput,
  ) {
    const existingMedicine = await this.medicinesRepository.findMedicineById(
      shopId,
      medicineId,
    );

    if (!existingMedicine) {
      throw buildAppError(404, "MEDICINE_NOT_FOUND", "Medicine not found.");
    }

    const nextCategoryId =
      input.categoryId ?? existingMedicine.medicine.categoryId;
    const nextManufacturerId =
      input.manufacturerId ?? existingMedicine.medicine.manufacturerId;

    const category = await this.medicinesRepository.findCategoryById(
      shopId,
      nextCategoryId,
    );

    if (!category) {
      throw buildAppError(404, "CATEGORY_NOT_FOUND", "Category not found.");
    }

    if (category.status !== "active") {
      throw buildAppError(
        400,
        "CATEGORY_INACTIVE",
        "Only active categories can be used for medicines.",
      );
    }

    const manufacturer = await this.medicinesRepository.findManufacturerById(
      shopId,
      nextManufacturerId,
    );

    if (!manufacturer) {
      throw buildAppError(
        404,
        "MANUFACTURER_NOT_FOUND",
        "Manufacturer not found.",
      );
    }

    if (manufacturer.status !== "active") {
      throw buildAppError(
        400,
        "MANUFACTURER_INACTIVE",
        "Only active manufacturers can be used for medicines.",
      );
    }

    const nextMedicineName =
      input.medicineName ?? existingMedicine.medicine.medicineName;
    const nextGenericName =
      input.genericName ?? existingMedicine.medicine.genericName;
    const nextBrandName =
      input.brandName !== undefined
        ? input.brandName
        : existingMedicine.medicine.brandName ?? undefined;
    const nextStrength =
      input.strength !== undefined
        ? input.strength
        : existingMedicine.medicine.strength ?? undefined;
    const nextForm = input.form ?? existingMedicine.medicine.form;
    const nextBarcode =
      input.barcode !== undefined
        ? input.barcode
        : existingMedicine.medicine.barcode ?? undefined;

    const medicineNameNormalized = normalizeSearchValue(nextMedicineName);
    const genericNameNormalized = normalizeSearchValue(nextGenericName);
    const brandNameNormalized = nextBrandName
      ? normalizeSearchValue(nextBrandName)
      : undefined;
    const strengthNormalized = toOptionalNormalizedValue(nextStrength);

    const duplicate = await this.medicinesRepository.findMedicineDuplicate(
      shopId,
      {
        medicineNameNormalized,
        strengthNormalized,
        form: nextForm,
        manufacturerId: nextManufacturerId,
        excludeId: medicineId,
      },
    );

    if (duplicate) {
      throw buildAppError(
        409,
        "MEDICINE_ALREADY_EXISTS",
        "A medicine with the same name, strength, form, and manufacturer already exists.",
      );
    }

    if (nextBarcode) {
      const barcodeDuplicate = await this.medicinesRepository.findMedicineByBarcode(
        shopId,
        nextBarcode,
        medicineId,
      );

      if (barcodeDuplicate) {
        throw buildAppError(
          409,
          "MEDICINE_BARCODE_CONFLICT",
          "Another medicine already uses this barcode.",
        );
      }
    }

    const updatedMedicine = await this.medicinesRepository.updateMedicine(
      medicineId,
      {
        ...(input.medicineName !== undefined
          ? {
              medicineName: input.medicineName,
              medicineNameNormalized,
            }
          : {}),
        ...(input.genericName !== undefined
          ? {
              genericName: input.genericName,
              genericNameNormalized,
            }
          : {}),
        ...(input.brandName !== undefined
          ? {
              brandName: input.brandName,
              brandNameNormalized,
            }
          : {}),
        ...(input.strength !== undefined
          ? {
              strength: input.strength,
              strengthNormalized,
            }
          : {}),
        ...(input.form !== undefined ? { form: input.form } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.manufacturerId !== undefined
          ? { manufacturerId: input.manufacturerId }
          : {}),
        ...(input.hsnCode !== undefined ? { hsnCode: input.hsnCode } : {}),
        ...(input.gstPercent !== undefined ? { gstPercent: input.gstPercent } : {}),
        ...(input.barcode !== undefined ? { barcode: input.barcode } : {}),
        ...(input.reorderLevel !== undefined
          ? { reorderLevel: input.reorderLevel }
          : {}),
        ...(input.prescriptionRequired !== undefined
          ? { prescriptionRequired: input.prescriptionRequired }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    );

    if (!updatedMedicine) {
      throw buildAppError(
        500,
        "MEDICINE_UPDATE_FAILED",
        "Failed to update medicine.",
      );
    }

    return this.getMedicineById(shopId, updatedMedicine.id);
  }

  async updateMedicineStatus(
    shopId: string,
    medicineId: string,
    input: UpdateMedicineStatusInput,
  ) {
    const medicine = await this.medicinesRepository.findMedicineById(
      shopId,
      medicineId,
    );

    if (!medicine) {
      throw buildAppError(404, "MEDICINE_NOT_FOUND", "Medicine not found.");
    }

    const updatedMedicine = await this.medicinesRepository.updateMedicineStatus(
      medicineId,
      input.status,
    );

    if (!updatedMedicine) {
      throw buildAppError(
        500,
        "MEDICINE_STATUS_UPDATE_FAILED",
        "Failed to update medicine status.",
      );
    }

    return this.getMedicineById(shopId, medicineId);
  }
}
