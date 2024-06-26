import projectModel from "../../../models/adminModels/project.model.js";
import { responseData } from "../../../utils/respounse.js";
import AWS from "aws-sdk";
import dotenv from "dotenv";
import {
  onlyAlphabetsValidation,
  onlyEmailValidation,
  onlyPhoneNumberValidation,
} from "../../../utils/validation.js";
import validator from "validator";
dotenv.config();

const s3 = new AWS.S3({
  accessKeyId: process.env.ACCESS_KEY,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
  region: "ap-south-1",
});

const uploadFile = async (file, fileName, project_ID, quotation_id, item_id) => {
  return s3
    .upload({
      Bucket: `collegemanage/${project_ID}/${quotation_id}/${item_id}`,
      Key: fileName,
      Body: file.data,
      ContentType: file.mimetype,
      // ACL: 'public-read'
    })
    .promise();
};

function generateSixDigitNumber() {
  const min = 100000;
  const max = 999999;
  const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;

  return randomNumber;
}

const saveQuotationData = async (
  res,
  existingQuotationData,
  isFirst = false
) => {
  try {
    if (isFirst) {
      //  const insertQuotationData = new projectModel(existingQuotationData);
      // await insertQuotationData.save();
      await projectModel.updateOne(
        { project_id: existingQuotationData.project_id },
        { $push: { quotation: existingQuotationData } }
      );
      responseData(res, "First Quotation created successfully", 200, true);
    } else {
      try {
        const updateResult = await projectModel.updateOne(
          {
            project_id: existingQuotationData.project_id,
            "quotation.type": existingQuotationData.type,
          },
          {
            $addToSet: {
              "quotation.$.items": { $each: existingQuotationData.items },
            },
          }
        );
        if (updateResult.modifiedCount === 1) {
          responseData(res, "Quotation data updated successfully", 200, true);
        } else {
          console.log("Quotation data not found or already updated");
          responseData(
            res,
            "",
            404,
            false,
            "Quotation data not found or already updated"
          );
        }
      } catch (error) {
        console.error("Error updating quotation data:", error);
        responseData(res, "", 500, false, "Error updating quotation data");
      }
    }
  } catch (error) {
    responseData(
      res,
      "",
      500,
      false,
      "Something went wrong. Quotation data not updated"
    );
  }
};

export const createQuotation = async (req, res) => {
  const project_id = req.body.project_id;
  const item = req.body.item;
  const description = req.body.description;
  const unit = req.body.unit;
  const quantity = req.body.quantity;
  const rate = req.body.rate;
  const discount = req.body.discount;
  const offer_price = req.body.offer_price;
  const total_price = req.body.total_price;
  const remark = req.body.remark;
  const client_notes = req.body.client_notes;
  const type = req.body.type;

  try {
    const find_project = await projectModel.findOne({ project_id });

    if (!find_project) {
      return responseData(res, "Project not found", false, 404);
    }

    const quotation_id = `CCPL/${generateSixDigitNumber()}`;
    const item_id = `ITM/${generateSixDigitNumber()}`;
    const files = req.files?.files;
    const fileUploadPromises = [];
    let successfullyUploadedFiles = [];

    if (files) {
      const filesToUpload = Array.isArray(files)
        ? files.slice(0, 5)
        : [files];

      for (const file of filesToUpload) {
        const fileName = Date.now() + file.name;
        fileUploadPromises.push(
          uploadFile(file, fileName, project_id, quotation_id, item_id)
        );
      }

      const responses = await Promise.all(fileUploadPromises);

      const fileUploadResults = responses.map((response) => ({
        status: response.Location ? true : false,
        data: response ? response : response.err,
      }));

      successfullyUploadedFiles = fileUploadResults.filter(
        (result) => result.status
      );
    }
    let file = []
    if (successfullyUploadedFiles.length > 0) {
      const newfileuploads = successfullyUploadedFiles.map(
        (result, index) => file.push(result.data.Location)
      );
    }




    const existingQuotation = find_project.quotation.find(
      (q) => q.type === type
    );

    if (existingQuotation) {
      const existingQuotationData = [...existingQuotation.items];
      const newQuotationItem = {
        item_id: item_id,
        item: item,
        description: description,
        unit: unit,
        quantity: quantity,
        rate: rate,
        discount: discount,
        offer_price: offer_price,
        total_price: total_price,
        files: file,
        remark: remark,
        client_notes: client_notes,
      };
      existingQuotationData.push(newQuotationItem);
      const createQuotationObj = {
        project_id,
        quotation_id,
        type,
        items: existingQuotationData,
      };
      await saveQuotationData(res, createQuotationObj);
    } else {
      const newQuotationItem = {
        item_id: `ITM/${generateSixDigitNumber()}`,
        item: item,
        description: description,
        unit: unit,
        quantity: quantity,
        rate: rate,
        discount: discount,
        offer_price: offer_price,
        total_price: total_price,
        files: file,
        remark: remark,
        client_notes: client_notes,
      };
      const createQuotationObj = {
        project_id,
        quotation_id,
        type,
        items: [newQuotationItem],
      };
      await saveQuotationData(res, createQuotationObj, true);
    }
  } catch (error) {
    responseData(res, false, 500, error.message);
    console.log(error);
  }
};
