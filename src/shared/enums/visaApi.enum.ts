export const visaAPiEnums = {
  METHODS: {
    GET: "GET",
    POST: "POST",
    PUT: "PUT",
    DELETE: "DELETE",
  },

  ENDPOINTS: {
    AUTH: {
      GET_TOKEN: "/auth/generate-token",
    },

    COUNTRY_AND_VISA_DATA: {
      COUNTRY: "/countries?page_no=1&page_size=10&symbols=NZL,IDN,VNM,AUS",
      VISA_TYPES_BY_COUNTRIES: "/visa_types",
      VISA_TYPE_REQUIREMENTS:
        "/visa_types/requirements?visa_type_id=647996b4f4869c92c4d1696f",
    },

    ORDER_MANAGEMENT: {
      CREATE_ORDER: "/orders",
      BULK_UPLOAD_FILES: "/documents/bulk-upload",
      APPLICATION_DETAILS:
        "/orders/application-overview?order_id=67c831553462ce30b3791d3b",
      DOCUMENTS_OVERVIEW:
        "/orders/documents-overview?order_id=67c831553462ce30b3791d3b",
      SEARCH_ORDER: "/orders/search?page_no=1&page_size=5",
      SINGLE_UPLOAD_AGAINST_ORDER: "/document/single-upload",
      DOCUMENTS: "/documents?order_id=67c831553462ce30b3791d3b",
      ORDERS_LIST:
        "/orders/searchByIds?order_ids=67cc069f022fe049aedddbd7,67cc05e594aa9bc49223ba51",
    },
  },
};
