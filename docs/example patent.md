                               FORM-2


                      THE PATENTS ACT, 1970
                              (39 of 1970)
 5                                 &
                    THE PATENTS RULES, 2003


                             COMPLETE
                          SPECIFICATION
10                    (See section 10 and rule 13)


                       TITLE OF INVENTION


         WALLET-BASED MULTI-ENTITY FOOD ORDERING AND
15       MANAGEMENT SYSTEM FOR CAMPUS ENVIRONMENTS


                APPLICANT NAME AND ADDRESS


                     Vellore Institute of Technology
20               An Indian University having address as:
                   Vellore Campus, Vellore - 632 014
                           Tamil Nadu, India


     THE FOLLOWING SPECIFICATION PARTICULARLY DESCRIBES
25    THE INVENTION AND THE MANNER IN WHICH IT IS TO BE
                            PERFORMED




                                                           Signature Not Verified
                                   1
                                                           Digitally Signed.
                                                           Name: Kuldeep Singh
                                                           Date: 08-Mar-2026 15:04:57
                                                           Reason: Patent Efiling
                                                           Location: DELHI
     CROSS-REFERENCE TO RELATED APPLICATIONS AND PRIORITY
     [0001]         The present application does not claim priority from any patent
     application.
     PREAMBLE
 5   [0002]         The following specification particularly describes the invention and the
     manner in which it is to be performed.
                                     FIELD OF INVENTION
     [0003]         The present disclosure relates to web-based food ordering and
     management systems with digital wallet mechanisms, and more particularly to a
10   wallet-based multi-entity food ordering and management system for educational
     campus environments that integrates staff-verified wallet recharge, automatic
     balance deduction and refund handling, multi-entity segregation, and personalized
     food recommendations.
                                         BACKGROUND
15   [0004]         The following text of background art is provided for purposes of
     understanding and is not an admission that any cited document or technique forms
     part of the prior art under applicable law.
     [0005]         Web-based food ordering systems have evolved to address various
     aspects of restaurant and food service management. US20090204492A1 to Scifo et
20   al. describes an online food ordering system and method that provides a web-based
     multi-restaurant ordering platform with merchant accounts, a fixed registration fee
     model, and direct payment routing via multiple servers. This system enables online
     food ordering across multiple restaurants and provides accessibility by location and
     cuisine. However, such systems depend on online payment gateways, rely on fax
25   or email order transmission, require complex multi-server setups, and lack delivery
     logistics control, making them unsuitable for closed campus mess environments
     where physical payment verification may be preferred.
     [0006]         Digital payment and wallet systems have been developed for various
     commercial applications. US20210366586A1 to Ryan et al. describes an enterprise
30   consumer safety system that employs blockchain-based data recording of point-of-
     sale transactions and originates consumer digital credit using direct account



                                                 2
     transfers, ACH, and digital-wallet-to-digital-wallet payments linked to a secure
     database. While this system enables secure and auditable payments across
     merchants and supports loyalty programs, it requires blockchain and point-of-sale
     integration that increases complexity and deployment cost. Furthermore, such
 5   systems are focused on general retail applications and are not tailored to campus
     mess environments or per-mess wallet segregation.
     [0007]      Recommendation systems for food-related applications have also been
     developed. KR20240026603A describes a system and method for providing
     personalized drug interaction analysis and health functional food recommendation
10   using server-database architecture, user health checkup data, survey data,
     undirected weighted graphs for drug-food interaction analysis, K-Nearest Neighbor
     algorithms for health state typing, and user-based collaborative filtering for ranking
     recommended foods. While this system provides personalized functional-food
     recommendations, it is focused on health-functional foods and medical interactions
15   rather than everyday canteen or mess meals, and relies on detailed medical and
     nutrition data that may be difficult to obtain and maintain in a typical campus dining
     context.
     [0008]      Third-party food ordering control systems have been described in
     US20210158323A1, which discloses a system enabling administrators to deposit
20   funds into accounts and set regulations on purchases for subordinate users, with
     point-of-sale integration at restaurants and retailers. Similarly, US20200265506A1
     describes a marketplace platform connecting consumers with home chefs using
     artificial intelligence for recommendations. US20190279272A1 describes a food
     sharing system with a central server for connecting food providers with consumers
25   using credits-based payment mechanisms. However, these systems are designed for
     general commercial food ordering scenarios and do not address the specific
     requirements of campus mess environments where multiple independent food
     service entities operate under centralized administration with staff-verified physical
     payment workflows.
30   [0009]      Existing food ordering and payment systems present several technical
     challenges when applied to educational campus mess environments. First,



                                               3
     conventional online payment systems require integration with external payment
     gateways, which may not be suitable for campus environments where physical cash
     payment at mess counters is preferred. Second, existing multi-vendor platforms do
     not provide per-entity wallet segregation where users maintain separate balances
 5   for each food service entity. Third, conventional systems lack mechanisms for staff-
     verified wallet recharge where physical payment is confirmed before digital balance
     updates. Fourth, existing systems do not provide automatic refund processing that
     instantly credits wallet balances upon order cancellation or rejection without multi-
     party banking reconciliation delays.
10   [0010]      It has been appreciated that a system and method is needed that
     overcomes one or more of these problems.
     [0011]      The present invention addresses the above shortcomings of the prior art.
     However, the invention is entirely different from the prior art in terms of novelty
     and technological advancements.
15   OBJECT
     [0012]      In view of the foregoing, and without prejudice to the generality of the
     disclosure, it is an object of the present invention to provide. It is to be understood
     that the foregoing objects are illustrative and non-limiting; additional objects will
     be apparent from the description, examples, and claims, and need not be achieved
20   in every embodiment.
     [0013]      The object of the present disclosure is to provide a wallet-based multi-
     entity food ordering and management system specifically designed for educational
     campus environments that overcomes the limitations of existing food ordering and
     payment systems. The system aims to provide a secure wallet-based payment
25   mechanism that operates without requiring integration with external online
     payment gateways, thereby enabling staff-verified wallet recharge based on
     physical payment confirmation at food service counters. Further, the system seeks
     to enable independent operation of multiple food service entities within a single
     centralized platform, wherein each user maintains a separate wallet balance
30   associated with each food service entity, allowing for per-entity wallet segregation.
     The system also aims to automate wallet balance deduction upon order placement



                                               4
     and provide instantaneous refund processing upon order cancellation or rejection,
     thereby eliminating the multi-party banking reconciliation delays associated with
     conventional online payment systems. Additionally, the system seeks to provide
     personalized food item recommendations based on user ordering history and
 5   ordering patterns of similar users, and to implement staff-driven order status
     management with automated email notifications to users regarding wallet recharge
     approval or disapproval, order acceptance, order rejection, and order readiness. By
     integrating these features within a unified platform, the system aims to reduce
     waiting times in campus food service environments, streamline coordination
10   between counter staff and kitchen staff, and enhance the overall food ordering
     experience for users in educational campus settings.
     [0014]      For the avoidance of doubt, the foregoing objects encompass
     compositions and manufacturing processes suitable for adoption in jurisdictions
     where claims to methods of treatment of animals may be restricted; corresponding
15   “use” or “product” claim formats are contemplated without limitation.
                                         SUMMARY
     [0015]      The following summary is intended to introduce aspects of the present
     invention in a simplified form and does not identify all the features or the scope of
     the claimed invention. The summary is provided to assist in understanding the
20   invention and is to be read in conjunction with the detailed description and
     accompanying drawings, claims, and abstract. One or more embodiments of the
     present disclosure are set forth below solely for illustrative purposes and should not
     be construed as limiting.
     [0016]      In a first aspect, a food ordering and management system is provided.
25   The system comprises a server configured to manage a plurality of food service
     entities, each food service entity having an independent menu; a database
     configured to store, for each user, a separate wallet balance associated with each
     food service entity; a user interface module configured to receive wallet recharge
     requests specifying a food service entity and a recharge amount, and to receive food
30   orders from users; a staff interface module configured to receive staff input for
     approving or disapproving wallet recharge requests; a wallet management module



                                               5
     configured to update the wallet balance associated with a food service entity upon
     staff approval of a corresponding recharge request, to automatically deduct an order
     amount from the wallet balance upon placement of a food order, and to
     automatically refund the deducted amount to the wallet balance upon cancellation
 5   or rejection of the food order; and an order management module configured to
     receive staff input for changing order status including acceptance, rejection, or
     marking as ready.
     [0017]      The system architecture provides several technical advantages. By
     maintaining separate wallet balances for each food service entity, the system
10   enables independent financial management across multiple food service operations
     within a single platform. The staff-verified wallet recharge mechanism eliminates
     dependency on external online payment gateways, thereby reducing integration
     complexity and enabling physical payment verification at food service counters.
     The automatic deduction and refund functionality ensures accurate wallet balance
15   management without manual intervention, reducing transaction errors and
     eliminating the multi-day delays associated with conventional banking
     reconciliation processes for refunds.
     [0018]      The system may further comprise a recommendation module
     configured to generate personalized food item recommendations for a user based
20   on ordering history of the user and ordering patterns of other users having similar
     ordering behaviour.
     [0019]      The recommendation module enhances user experience by analyzing
     past ordering behaviour and identifying patterns among users with similar
     preferences. This enables the system to suggest food items that a user has not
25   previously ordered but may find appealing based on the preferences of similar users,
     thereby improving ordering convenience and facilitating discovery of new menu
     items.
     [0020]      The system may further comprise a notification module configured to
     transmit email notifications to users based on staff actions, wherein the email
30   notifications include notifications for wallet recharge approval, wallet recharge
     disapproval, order acceptance, order rejection, and order readiness.



                                              6
     [0021]      The notification module provides real-time communication between the
     system and users, ensuring that users are promptly informed of changes to their
     wallet status and order progress. This automated notification mechanism reduces
     the need for users to manually check order status, improves transparency in the
 5   ordering process, and enables users to collect their orders promptly upon readiness
     notification.
     [0022]      The system may further comprise an administrator interface module
     configured to register food service entities, create staff accounts associated with
     each food service entity, and configure system settings for the plurality of food
10   service entities.
     [0023]      The administrator interface module enables centralized management of
     multiple food service entities while maintaining operational independence for each
     entity. This architecture allows educational institutions to manage all campus food
     service operations from a single administrative platform, simplifying the
15   registration and configuration of new food service entities and associated staff
     accounts.
     [0024]      The wallet management module may be further configured to prevent
     placement of a food order when the wallet balance associated with the
     corresponding food service entity is insufficient to cover the order amount.
20   [0025]      This balance verification functionality ensures that orders are placed
     only when adequate funds are available, preventing failed transactions and reducing
     operational complications for food service staff. By validating wallet balance prior
     to order confirmation, the system maintains financial integrity and provides
     immediate feedback to users regarding insufficient funds.
25   [0026]      In a second aspect, a computer-implemented method for managing food
     ordering across a plurality of food service entities is provided. The method
     comprises receiving, at a server, a wallet recharge request from a user, the wallet
     recharge request specifying a food service entity and a recharge amount; receiving
     staff input indicating approval or disapproval of the wallet recharge request;
30   updating a wallet balance associated with the user and the food service entity based
     on the staff input; receiving a food order from the user for the food service entity;



                                              7
     automatically deducting an order amount from the wallet balance upon placement
     of the food order; receiving staff input indicating a change in order status; and
     automatically refunding the deducted amount to the wallet balance upon the order
     status indicating rejection or cancellation.
 5   [0027]      The method provides a streamlined workflow for wallet-based food
     ordering that integrates staff verification with automated balance management. By
     requiring staff approval before updating wallet balances, the method ensures that
     physical payment has been verified before digital credits are applied. The automatic
     deduction and refund mechanisms eliminate manual balance adjustments, reducing
10   processing time and minimizing errors in financial transactions. This workflow
     enables instantaneous refund processing upon order cancellation or rejection,
     avoiding the delays of two to ten working days typically associated with
     conventional online payment refund processes.
     [0028]      The method may further comprise generating personalized food item
15   recommendations for the user based on ordering history of the user and ordering
     patterns of other users having similar ordering behaviour.
     [0029]      Generating personalized recommendations based on ordering history
     and similar user patterns enables the system to present relevant food suggestions to
     each user. This approach leverages collaborative filtering techniques to identify
20   food items that users with comparable ordering behaviour have selected, thereby
     improving the likelihood that recommended items will appeal to the user and
     enhancing overall ordering efficiency.
     [0030]      The method may further comprise transmitting email notifications to
     the user based on the change in order status, wherein the email notifications include
25   notifications for order acceptance, order rejection, and order readiness.
     [0031]      Transmitting email notifications based on order status changes ensures
     that users receive timely updates regarding their orders without requiring manual
     status checks. This automated communication mechanism improves coordination
     between users and food service staff, enables users to plan their food collection
30   timing, and provides confirmation of order processing outcomes.




                                               8
     [0032]      In a third aspect, a non-transitory computer-readable medium storing
     instructions that, when executed by one or more processors, cause the one or more
     processors to perform the method of the second aspect is provided.
     [0033]      The non-transitory computer-readable medium enables deployment of
 5   the food ordering and management method across various computing platforms and
     server configurations. By storing executable instructions, the medium facilitates
     implementation of the wallet-based ordering workflow in different hardware
     environments while maintaining consistent functionality.
     [0034]      The instructions stored on the non-transitory computer-readable
10   medium may further cause the one or more processors to generate personalized food
     item recommendations for the user based on ordering history of the user and
     ordering patterns of other users having similar ordering behaviour.
     [0035]      Including recommendation generation instructions on the computer-
     readable medium enables the deployed system to provide personalized food
15   suggestions as part of the ordering workflow. This integration of recommendation
     functionality with the core ordering and wallet management operations creates a
     unified platform that enhances user engagement while maintaining the benefits of
     staff-verified wallet management and automated balance processing.
     [0036]      The foregoing general description of the illustrative embodiments and
20   the following detailed description thereof are merely exemplary aspects of the
     teachings of this disclosure and are not restrictive.
                            BRIEF DESCRIPTION OF FIGURES
     [0037]      The drawings appended herein illustrate exemplary embodiments of the
     present invention and are provided to enhance understanding of the inventive
25   features disclosed. These figures, when read in conjunction with the detailed
     description, depict the operational flow, component architecture, and other
     mechanisms.
     [0038]      The illustrations are schematic in nature and serve solely to clarify the
     principles and functionality of the present disclosure. While particular constructions
30   and configurations are depicted for explanatory purposes, it will be understood that




                                                9
     the invention is not limited to the precise implementations shown in the figures and
     may encompass variations without departing from the scope of protection.
     [0039]      FIG. 1 illustrates a flowchart for a computer-implemented method for
     managing food ordering across a plurality of food service entities, according to
 5   aspects of the present disclosure.
     [0040]      FIG. 2 illustrates a flowchart for a method for generating personalized
     food item recommendations and transmitting email notifications based on order
     status changes, according to an embodiment.
     [0041]      FIG. 3 illustrates a flowchart for a system workflow for wallet recharge
10   and food ordering process, according to aspects of the present disclosure.
     [0042]      FIG. 4 illustrates a flowchart for a method for wallet balance
     verification when processing food orders, according to an embodiment.
     [0043]      Furthermore, in terms of the construction of the system, one or more
     components of the device may have been represented in the figures by conventional
15   symbols, and the figures may show only those specific details that are pertinent to
     understanding the embodiments of the present invention so as not to obscure the
     figures with details that will be readily apparent to those of ordinary skill in the art
     having benefit of the description herein.
                                 DETAILED DESCRIPTION
20   [0044]      The following detailed description is intended to provide an in-depth
     understanding of the invention and its various components, configurations, and
     operational aspects. While specific embodiments are described with reference to
     the accompanying drawings, the invention is not limited to the particular forms
     disclosed herein. The scope of the invention shall be interpreted broadly and in
25   accordance with the claims appended hereto.
     [0045]      The terms “comprises,” “comprising,” “includes,” “including,” and
     similar expressions used in this description are intended to be open-ended and
     should be interpreted to include, but not be limited to, the mentioned elements.
     Unless explicitly stated otherwise, singular terms may include their plural
30   equivalents and vice versa, depending on the context in which they appear.




                                                 10
     [0046]      Reference is now made to the accompanying figures, which illustrate
     example embodiments of the present invention. It should be appreciated that the
     figures are intended for illustration and explanatory purposes only and do not limit
     the scope of the invention. Similar reference numerals have been used to denote
 5   functionally similar components throughout the figures.
     [0047]      The embodiments described herein are presented for illustrative
     purposes and are subject to variations, modifications, and adaptations by those
     skilled in the art. Any equivalent implementations that perform substantially the
     same function in substantially the same manner are intended to fall within the scope
10   of this disclosure and the claims appended hereto.
     [0048]      The use of the term “exemplary” in the description shall be understood
     to mean “serving as an example or illustration” and shall not be construed as
     limiting the invention to the preferred embodiments disclosed. Various other
     embodiments may be developed without departing from the spirit or essential
15   characteristics of the invention. The technical principles and advantages outlined in
     the foregoing description should be read in conjunction with the figures and claims.
     It is expressly understood that while the detailed description sets out specific
     structural and operational aspects, the scope of protection is governed by the claims
     and includes all legal equivalents of the claimed subject matter. Embodiments of
20   the disclosure are described in the following paragraphs with reference to Figures.
     In Figures, the same elements or elements that have the same functions are indicated
     by the same reference signs.
     [0049]      The present invention will now be described in detail with reference to
     the accompanying drawings illustrating exemplary embodiments.
25   [0050]      FIG. 1 illustrates a flowchart for a computer-implemented method 100
     for managing food ordering across a plurality of food service entities 110 according
     to various embodiments.
     [0051]      The method 100 begins with a step 102, where a server 102 receives a
     wallet recharge request from a user 120. The wallet recharge request specifies a
30   food service entity 110 and a recharge amount. The user 120 initiates the wallet




                                              11
     recharge request online through a user interface and subsequently completes
     physical payment at a mess counter associated with the food service entity 110.
     [0052]        The method 100 proceeds to a step 104, where the server 102 receives
     staff input indicating approval or disapproval of the wallet recharge request. Staff
 5   associated with the food service entity 110 verify the physical payment made by
     the user 120 at the mess counter before providing the staff input. The staff input
     reflects whether the physical payment has been received and verified.
     [0053]        The method 100 then moves to a step 106, which represents a decision
     point for determining whether the wallet recharge request is approved based on the
10   staff input. At step 106, the server 102 evaluates the staff input to determine the
     approval status of the wallet recharge request.
     [0054]        If the wallet recharge request is not approved at step 106, the method
     100 proceeds to a step 108, where the process ends due to recharge disapproval.
     The wallet balance 122 associated with the user 120 and the food service entity 110
15   remains unchanged when the recharge request is disapproved.
     [0055]        If the wallet recharge request is approved at step 106, the method 100
     proceeds to a step 110, where the server 102 updates a wallet balance 122 associated
     with the user 120 and the food service entity 110 based on the staff input. The wallet
     balance 122 is incremented by the recharge amount specified in the wallet recharge
20   request.
     [0056]        The method 100 continues to a step 112, where the server 102 receives
     a food order from the user 120 for the food service entity 110. The food order
     specifies one or more food items from a menu associated with the food service
     entity 110.
25   [0057]        The method 100 then proceeds to a step 114, where a wallet
     management module automatically deducts an order amount from the wallet
     balance 122 upon placement of the food order. The automatic deduction occurs at
     the time of order placement without requiring additional user action.
     [0058]        The method 100 moves to a step 116, where the server 102 receives
30   staff input indicating a change in order status. The order status change includes
     acceptance, rejection, or marking the food order as ready.



                                              12
     [0059]     The method 100 then proceeds to a step 118, which represents a
     decision point for determining whether the order status indicates rejection or
     cancellation. At step 118, the server 102 evaluates the order status to determine
     whether a refund is to be processed.
 5   [0060]     If the order status indicates rejection or cancellation at step 118, the
     method 100 proceeds to a step 120, where the wallet management module
     automatically refunds the deducted amount to the wallet balance 122. The wallet
     management module processes refunds automatically and instantaneously within a
     few seconds upon order cancellation or rejection. This automatic refund processing
10   contrasts with conventional online payment systems where refunds typically
     require two to ten working days due to multi-party banking reconciliation.
     [0061]     If the order status does not indicate rejection or cancellation at step 118,
     the method 100 proceeds to a step 122, where the server 102 processes the order as
     accepted or ready. The food order proceeds through the order fulfillment workflow
15   when the order status indicates acceptance or readiness.
     [0062]     FIG. 2 illustrates a flowchart for a method 200 for generating
     personalized food item recommendations and transmitting email notifications
     based on order status changes according to various embodiments.
     [0063]     The method 200 begins with a step 202, where a server 102 receives a
20   food order from a user 120. The food order specifies one or more food items from
     a menu 112 associated with a food service entity 110.
     [0064]     The method 200 proceeds to a step 204, where a recommendation
     module 170 analyzes the ordering history of the user 120. The recommendation
     module 170 retrieves and processes historical food order data associated with the
25   user 120 to identify ordering patterns and preferences.
     [0065]     The method 200 then moves to a step 206, where the recommendation
     module 170 identifies other users 120 with similar ordering behaviour. The
     recommendation module 170 compares ordering behavior across similar users to
     identify food items the user 120 has not yet tried. The comparison involves
30   analyzing ordering patterns of other users 120 having similar ordering behaviour to
     determine commonalities and differences in food item selections.



                                              13
     [0066]       The method 200 advances to a step 208, where the recommendation
     module 170 generates personalized food item recommendations for the user 120
     based on the ordering history of the user 120 and the ordering patterns of other users
     120 having similar ordering behaviour. The recommendation module 170 uses a
 5   hybrid approach combining 60% collaborative filtering and 40% content-based
     filtering to generate personalized recommendations. The recommendation module
     170 excludes previously ordered items from the recommendations to suggest new
     food items to the user 120. Through this exclusion mechanism, the recommendation
     module 170 identifies untried items that align with the preferences of the user 120.
10   [0067]       The method 200 continues to a step 210, where the server 102 receives
     a change in order status from staff associated with the food service entity 110. The
     change in order status reflects staff actions performed through a staff interface
     module 140.
     [0068]       The method 200 then proceeds to a step 212, which represents a
15   decision point for determining whether the order is accepted, rejected, or ready. At
     step 212, the server 102 evaluates the change in order status to determine whether
     an email notification is to be transmitted.
     [0069]       If the order status indicates acceptance, rejection, or readiness at step
     212, the method 200 proceeds to a step 214, where a notification module 180
20   transmits email notifications to the user 120 based on the change in order status.
     The notification module 180 is configured to transmit email notifications to users
     120 based on staff actions. The email notifications include notifications for order
     acceptance, order rejection, and order readiness. The notification module 180 is
     further configured to transmit email notifications for wallet recharge approval and
25   wallet recharge disapproval events triggered by staff actions. Through this
     configuration, the email notifications include notifications for wallet recharge
     approval, wallet recharge disapproval, order acceptance, order rejection, and order
     readiness.
     [0070]       If the order status does not indicate acceptance, rejection, or readiness
30   at step 212, the method 200 proceeds to a step 216, where the process ends without




                                               14
     transmitting a notification. The method 200 terminates at step 216 when the change
     in order status does not correspond to a notification-triggering event.
     [0071]      FIG. 3 illustrates a flowchart for a method 300 depicting a system
     workflow for wallet recharge and food ordering process according to various
 5   embodiments.
     [0072]      The method 300 operates within a food ordering and management
     system 100 comprising a server 102 configured to manage a plurality of food
     service entities 110, each food service entity 110 having an independent menu 112.
     The system 100 further comprises a database 104 configured to store, for each user
10   120, a separate wallet balance 122 associated with each food service entity 110.
     The system 100 includes a user interface module 130 configured to receive wallet
     recharge requests specifying a food service entity 110 and a recharge amount, and
     to receive food orders from users 120. The system 100 further includes a staff
     interface module 140 configured to receive staff input for approving or
15   disapproving wallet recharge requests. The system 100 also includes a wallet
     management module 150 configured to update the wallet balance 122 associated
     with a food service entity 110 upon staff approval of a corresponding recharge
     request, to automatically deduct an order amount from the wallet balance 122 upon
     placement of a food order, and to automatically refund the deducted amount to the
20   wallet balance 122 upon cancellation or rejection of the food order. The system 100
     additionally includes an order management module 160 configured to receive staff
     input for changing order status including acceptance, rejection, or marking as ready.
     [0073]      Prior to initiating the method 300, the user 120 registers and logs into
     the system 100 before selecting a food service entity 110 and viewing the available
25   menu 112. The user 120 selects and changes between different food service entities
     110 within the platform. The staff interface module 140 includes secure login using
     email and password for mess staff authentication.
     [0074]      The method 300 begins with a step 302, where the user interface
     module 130 receives a wallet recharge request from the user 120. The wallet
30   recharge request specifies a food service entity 110 and a recharge amount. The
     user interface module 130 includes a search function for searching food items



                                              15
     within the menu 112. The system 100 displays food items with associated images,
     ingredients, and price information to users 120 when viewing the menu 112.
     [0075]      The method 300 proceeds to a step 304, where the staff interface
     module 140 receives staff approval input. Staff associated with the food service
 5   entity 110 provide the staff approval input after verifying physical payment
     received from the user 120 at the mess counter.
     [0076]      The method 300 then moves to a step 306, which represents a decision
     point for determining whether the recharge is approved by staff. At step 306, the
     server 102 evaluates the staff approval input to determine the approval status of the
10   wallet recharge request.
     [0077]      If the recharge is not approved at step 306, the method 300 proceeds to
     a step 308, where the recharge request is rejected. The wallet balance 122 associated
     with the user 120 and the food service entity 110 remains unchanged when the
     recharge request is rejected.
15   [0078]      If the recharge is approved at step 306, the method 300 proceeds to a
     step 310, where the wallet management module 150 updates the wallet balance 122.
     The wallet management module 150 increments the wallet balance 122 associated
     with the user 120 and the food service entity 110 by the recharge amount specified
     in the wallet recharge request.
20   [0079]      Following the wallet balance update at step 310, the method 300 moves
     to a step 312, where the user interface module 130 receives a food order from the
     user 120. The food order specifies one or more food items from the menu 112
     associated with the food service entity 110.
     [0080]      The method 300 then proceeds to a step 314, which represents a
25   decision point for determining whether the wallet balance 122 is sufficient to cover
     the order amount. At step 314, the wallet management module 150 compares the
     wallet balance 122 associated with the user 120 and the food service entity 110
     against the order amount.
     [0081]      If the wallet balance 122 is not sufficient at step 314, the method 300
30   proceeds to a step 316, where order placement is prevented. The wallet management
     module 150 prevents placement of the food order when the wallet balance 122



                                              16
     associated with the corresponding food service entity 110 is insufficient to cover
     the order amount.
     [0082]      If the wallet balance 122 is sufficient at step 314, the method 300
     proceeds to a step 318, where the wallet management module 150 deducts the order
 5   amount from the wallet balance 122. The wallet management module 150
     automatically deducts the order amount from the wallet balance 122 upon
     placement of the food order.
     [0083]      The method 300 then moves to a step 320, where the order management
     module 160 processes the order status. The order management module 160 receives
10   staff input for changing order status including acceptance, rejection, or marking as
     ready. When the order status indicates rejection or cancellation, the wallet
     management module 150 automatically refunds the deducted amount to the wallet
     balance 122, as described previously with reference to the method 100.
     [0084]      FIG. 4 illustrates a flowchart for a method 400 for wallet balance
15   verification when processing food orders according to various embodiments.
     [0085]      The method 400 begins with a step 402, where the server 102 receives
     a food order request from a user 120. The food order request specifies one or more
     food items from a menu 112 associated with a food service entity 110.
     [0086]      The method 400 proceeds to a step 404, where the wallet management
20   module 150 retrieves the wallet balance 122 for the corresponding food service
     entity 110. The wallet management module 150 accesses the database 104 to obtain
     the wallet balance 122 associated with the user 120 and the food service entity 110
     specified in the food order request.
     [0087]      The method 400 then moves to a step 406, where the wallet
25   management module 150 calculates the total order amount. The total order amount
     is determined based on the prices of the food items specified in the food order
     request.
     [0088]      The method 400 advances to a step 408, which represents a decision
     point for determining whether the wallet balance 122 is sufficient to cover the order
30   amount. At step 408, the wallet management module 150 compares the wallet
     balance 122 against the total order amount calculated at step 406.



                                              17
     [0089]        If the wallet balance 122 is sufficient at step 408, the method 400
     proceeds to a step 410, where the wallet management module 150 proceeds with
     order placement and deducts the amount from the wallet balance 122. The wallet
     management module 150 automatically deducts the total order amount from the
 5   wallet balance 122 upon placement of the food order.
     [0090]        The method 400 then continues to a step 414, where the order
     management module 160 receives the order. The order is submitted to the order
     management module 160 for processing by staff associated with the food service
     entity 110.
10   [0091]        If the wallet balance 122 is insufficient at step 408, the method 400
     proceeds to a step 412, where the wallet management module 150 prevents order
     placement and notifies the user 120. As described previously, the wallet
     management module 150 is configured to prevent placement of a food order when
     the wallet balance 122 associated with the corresponding food service entity 110 is
15   insufficient to cover the order amount.
     [0092]        The method 400 then moves to a step 416, where an insufficient balance
     message is displayed to the user 120. The user interface module 130 displays the
     insufficient balance message to inform the user 120 that the wallet balance 122 is
     insufficient to complete the food order request.
20   [0093]        Upon order acceptance by staff through the staff interface module 140,
     order details are digitally transmitted to a kitchen-facing interface. The kitchen-
     facing interface allows kitchen staff to view and manage multiple orders
     simultaneously without manual handoffs. The digital transmission of order details
     replaces physical order slips, enabling instant communication between counter staff
25   and kitchen staff.
     [0094]        Orders remain visible on the kitchen interface after being marked as
     ready by staff. Staff associated with the food service entity 110 can manually
     remove orders from the kitchen interface at their convenience. This configuration
     maintains flexibility in kitchen workflow while reducing coordination effort
30   between counter staff and kitchen staff.




                                                18
     [0095]      The system 100 further comprises an administrator interface module
     190 configured to register food service entities 110, create staff accounts associated
     with each food service entity 110, and configure system settings for the plurality of
     food service entities 110. The administrator interface module 190 provides
 5   centralized management capabilities for overseeing the operation of multiple food
     service entities 110 within the platform. The administrator interface module 190 is
     further configured to edit and delete registered food service entities 110 from the
     centralized platform. Through the administrator interface module 190, an
     administrator registers new food service entities 110 by entering mess name, owner
10   name, address, contact number, email, and password information. The
     administrator interface module 190 displays a list of registered food service entities
     110 with associated owner, address, contact, and email information, along with
     options to edit or delete each registered food service entity 110.
     [0096]      Staff associated with each food service entity 110 upload food items
15   with name, image, ingredients, and quantity information to create and manage the
     menu 112. The staff interface module 140 provides a food registration interface
     where staff enter food name, food type, ingredients or description, price, available
     quantity, and food image for each food item. Staff enable or disable food items to
     control their availability on the menu 112. When a food item is disabled, the food
20   item is not displayed to users 120 when viewing the menu 112. Staff update food
     quantity in real time to reflect current availability of each food item. When the
     available quantity of a food item is set to zero, the food item is marked as
     unavailable on the menu 112.
     [0097]      Users 120 and staff update their profile information including personal
25   and account details within the system 100. The user interface module 130 provides
     profile management functionality for users 120 to update personal information. The
     staff interface module 140 provides profile management functionality for staff to
     update mess name, owner name, address, and contact information associated with
     the food service entity 110.
30   [0098]      The system 100 is configured to reduce waiting time at the mess from
     approximately 15-20 minutes to approximately 2-4 minutes during peak hours by



                                              19
     enabling advance digital ordering. Conventional mess ordering during peak hours
     requires approximately 15-20 minutes for order placement due to physical queueing
     and manual payment. By enabling advance digital ordering and wallet-based
     payment, the system 100 reduces the waiting time at the mess to approximately 2-
 5   4 minutes, primarily for food collection. This configuration corresponds to an
     estimated waiting time reduction of 13-16 minutes, or approximately 75-85%
     during peak hours.
     [0099]      As described previously, the notification module 180 transmits email
     notifications to users 120 based on staff actions. The notification module 180
10   delivers email notifications with an expected delivery success rate of approximately
     98-99% and delivery time under 5 seconds under normal network conditions. The
     email notifications are triggered by system events including order acceptance, order
     rejection, order readiness, wallet recharge approval, wallet recharge disapproval,
     and refund processing.
15   [0100]      A non-transitory computer-readable medium stores instructions that,
     when executed by one or more processors 106, cause the one or more processors
     106 to perform the method for managing food ordering across a plurality of food
     service entities 110 as described previously with reference to the method 100. The
     instructions stored on the non-transitory computer-readable medium cause the one
20   or more processors 106 to receive wallet recharge requests, receive staff input
     indicating approval or disapproval, update wallet balances 122, receive food orders,
     automatically deduct order amounts, receive staff input indicating changes in order
     status, and automatically refund deducted amounts upon order rejection or
     cancellation.
25   [0101]      The instructions stored on the non-transitory computer-readable
     medium further cause the one or more processors 106 to generate personalized food
     item recommendations for the user 120 based on ordering history of the user 120
     and ordering patterns of other users having similar ordering behaviour. As
     described previously with reference to the method 200, the recommendation
30   module 170 analyzes ordering history, identifies other users 120 with similar




                                             20
     ordering behaviour, and generates personalized food item recommendations using
     a hybrid approach combining collaborative filtering and content-based filtering.
     [0102]      There are several technical advantages of the food ordering and
     management system of the present disclosure. First, the integration of staff-verified
 5   wallet recharge with automatic balance deduction and refund processing eliminates
     dependency on external online payment gateways, thereby reducing integration
     complexity and enabling physical payment verification at food service counters
     while providing instantaneous refund processing within seconds upon order
     cancellation or rejection, in contrast to conventional online payment systems where
10   refunds typically require two to ten working days due to multi-party banking
     reconciliation. Second, the maintenance of separate wallet balances for each food
     service entity enables independent financial management across multiple food
     service operations within a single centralized platform, allowing educational
     institutions to manage all campus food service operations while preserving
15   operational autonomy for each entity. Third, the system reduces waiting time at
     food service counters from approximately 15-20 minutes to approximately 2-4
     minutes during peak hours by enabling advance digital ordering and wallet-based
     payment, corresponding to an estimated waiting time reduction of approximately
     75-85%. Fourth, the digital transmission of order details to a kitchen-facing
20   interface replaces physical order slips, enabling instant communication between
     counter staff and kitchen staff and allowing kitchen staff to view and manage
     multiple   orders   simultaneously     without    manual    handoffs.    Fifth,   the
     recommendation module enhances user experience by generating personalized food
     item recommendations using a hybrid approach combining collaborative filtering
25   and content-based filtering, thereby improving ordering convenience and
     facilitating discovery of new menu items. Sixth, the notification module provides
     real-time communication through automated email notifications triggered by staff
     actions, ensuring users are promptly informed of wallet recharge approval or
     disapproval, order acceptance, order rejection, and order readiness with an expected
30   delivery success rate of approximately 98-99% and delivery time under 5 seconds
     under normal network conditions. These technical advantages collectively



                                              21
     contribute to an efficient and practical solution for food ordering and management
     specifically tailored for educational campus environments.
     [0103]      It will be appreciated that the above-detailed description, along with
     FIGs, is provided to illustrate the architecture and operation of exemplary
 5   embodiments of the present invention. Various modifications and enhancements
     can be made without departing from the scope of the invention. All such variations,
     as would be recognized by those skilled in the art, are intended to be within the
     scope of the present disclosure, which is defined by the claims that follow.
     [0104]      It will be appreciated by persons skilled in the art that while the
10   invention has been described with reference to specific embodiments and
     accompanying drawings, numerous modifications, substitutions, variations, and
     equivalents are possible without departing from the spirit or scope of the present
     invention. The use of singular terms such as “a,” “an,” and “the” is not intended to
     limit the disclosed elements to a single instance unless explicitly stated, and such
15   terms should be interpreted to include plural forms as applicable. Likewise, the
     terms “comprises,” “comprising,” “includes,” “including,” “has,” “having,” and
     their grammatical variants are intended to be open-ended and non-limiting, and
     should be interpreted as meaning “including but not limited to.” Any enumerated
     listing of components, features, or elements does not imply that the items are
20   mutually exclusive unless expressly stated.
     [0105]      It is further understood that where features, characteristics, or elements
     are described in connection with a Markush group or a disjunctive phrase (e.g., “A
     or B”), the invention includes all possible combinations and sub-combinations
     thereof unless explicitly excluded. Thus, a statement referring to “at least one of A,
25   B, and C” should be interpreted to mean any one or more of A, B, and C,
     individually or in any combination. The language used in this specification is
     selected primarily for clarity and illustrative purposes and should not be construed
     to limit the inventive scope unless specifically recited in the claims. Accordingly,
     the foregoing description of embodiments should be regarded as illustrative and not
30   restrictive, with the scope of the invention being defined solely by the appended
     claims and their legal equivalents



                                              22
     [0106]        It will be recognized that various features, elements, and combinations
     thereof described herein may be desirably adapted for alternative implementations
     or other applications. Many such modifications, substitutions, enhancements, or
     equivalents may become apparent to those skilled in the art upon reading this
 5   disclosure and are considered to fall within the scope and spirit of the present
     invention. The invention is not limited to the precise configurations or exemplary
     embodiments set forth in this specification, and various alternatives may be used
     without departing from the intended objectives. The claims, and not the detailed
     description, shall define the legal scope of protection afforded by the present
10   disclosure.
     [0107]        In interpreting the specification and claims, all terms should be
     construed in the broadest reasonable manner consistent with the context and the
     understanding of those skilled in the art. The use of terms such as “comprises,”
     “comprising,” “includes,” “including,” or “has” should be interpreted to be non-
15   exclusive and not limited to the stated elements alone. Moreover, references to “one
     embodiment,” “an embodiment,” or “in certain embodiments” are not meant to
     imply that such features are required or exclusive, and any feature described in
     connection with one embodiment may be used in combination with other features
     or embodiments unless clearly prohibited or contextually inconsistent.
20   [0108]        It should be further appreciated that reference throughout the
     specification to features, operations, or components using singular terms should not
     be construed as excluding a plurality thereof unless the context expressly indicates
     otherwise. Similarly, features described in the context of grouped or listed elements
     (e.g., A, B, and C) should be understood to encompass individual, multiple, or all
25   combinations of said elements. Where ranges are given, all intermediate values and
     subranges are understood to be disclosed as if specifically recited. The scope of the
     invention should therefore be construed as inclusive of all such combinations and
     logical extensions as would be appreciated by a person of ordinary skill in the
     relevant technical field
30   [0109]        In another embodiment, the above disclosure is a description of the
     invention and is not intended to limit the scope of the invention. Other variations



                                               23
     and modifications of the above-described embodiment shall be apparent to those
     skilled in the art and are intended to fall within the scope of the invention as defined
     in the following claims.


 5   Dated This 19th day of February 2026


                                                                           (Kuldeep Singh)
                                                      Authorized Agent for the Applicant,
                                              Indian Patent Agent Regn No. IN/PA-4358
10




                                               24
                                         CLAIMS
     WE CLAIM:
            1. A food ordering and management system (100) comprising:
            a server (102) configured to manage a plurality of food service entities
 5   (110), each food service entity (110) having an independent menu (112);
            a database (104) configured to store, for each user (120), a separate wallet
     balance (122) associated with each food service entity (110);
            a user interface module (130) configured to receive wallet recharge requests
     specifying a food service entity (110) and a recharge amount, and to receive food
10   orders from users (120);
            a staff interface module (140) configured to receive staff input for
     approving or disapproving wallet recharge requests;
            a wallet management module (150) configured to update the wallet balance
     (122) associated with a food service entity (110) upon staff approval of a
15   corresponding recharge request, to automatically deduct an order amount from the
     wallet balance (122) upon placement of a food order, and to automatically refund
     the deducted amount to the wallet balance (122) upon cancellation or rejection of
     the food order; and
            an order management module (160) configured to receive staff input for
20   changing order status including acceptance, rejection, or marking as ready.
            2. The system (100) of claim 1, further comprising a recommendation
     module (170) configured to generate personalized food item recommendations for
     a user (120) based on ordering history of the user (120) and ordering patterns of
     other users (120) having similar ordering behaviour.
25          3. The system (100) of claim 1 or 2, further comprising a notification
     module (180) configured to transmit email notifications to users (120) based on
     staff actions, wherein the email notifications include notifications for wallet
     recharge approval, wallet recharge disapproval, order acceptance, order rejection,
     and order readiness.
30          4. The system (100) of any of claims 1 to 3, further comprising an
     administrator interface module (190) configured to register food service entities



                                             25
     (110), create staff accounts associated with each food service entity (110), and
     configure system settings for the plurality of food service entities (110).
             5. The system (100) of any of claims 1 to 4, wherein the wallet management
     module (150) is further configured to prevent placement of a food order when the
 5   wallet balance (122) associated with the corresponding food service entity (110) is
     insufficient to cover the order amount.
             6. A computer-implemented method for managing food ordering across a
     plurality of food service entities (110), the method comprising:
             receiving, at a server (102), a wallet recharge request from a user (120), the
10   wallet recharge request specifying a food service entity (110) and a recharge
     amount;
             receiving staff input indicating approval or disapproval of the wallet
     recharge request;
             updating a wallet balance (122) associated with the user (120) and the food
15   service entity (110) based on the staff input;
             receiving a food order from the user (120) for the food service entity (110);
             automatically deducting an order amount from the wallet balance (122)
     upon placement of the food order;
             receiving staff input indicating a change in order status; and
20           automatically refunding the deducted amount to the wallet balance (122)
     upon the order status indicating rejection or cancellation.
             7. The method of claim 6, further comprising generating personalized food
     item recommendations for the user (120) based on ordering history of the user (120)
     and ordering patterns of other users having similar ordering behaviour.
25           8. The method of claim 6 or 7, further comprising transmitting email
     notifications to the user (120) based on the change in order status, wherein the email
     notifications include notifications for order acceptance, order rejection, and order
     readiness.
             9. A non-transitory computer-readable medium storing instructions that,
30   when executed by one or more processors (106), cause the one or more processors
     (106) to perform the method of claim 6.



                                               26
            10. The non-transitory computer-readable medium of claim 9, wherein the
     instructions further cause the one or more processors (106) to generate personalized
     food item recommendations for the user (120) based on ordering history of the user
     (120) and ordering patterns of other users having similar ordering behaviour.
 5
     Dated This 19th day of February 2026


                                                                        (Kuldeep Singh)
                                                    Authorized Agent for the Applicant,
10                                          Indian Patent Agent Regn No. IN/PA-4358




                                             27
                                        ABSTRACT
                WALLET-BASED MULTI-ENTITY FOOD ORDERING AND
                MANAGEMENT SYSTEM FOR CAMPUS ENVIRONMENTS
     A food ordering and management system (100) includes a server (102) managing
 5   food service entities (110) with independent menus (112), a database (104) storing
     separate wallet balances (122) for each user (120) per food service entity (110), a
     user interface module (130) receiving wallet recharge requests and food orders, a
     staff interface module (140) receiving staff input for approving recharge requests,
     a wallet management module (150) updating wallet balances (122) upon staff
10   approval, automatically deducting order amounts upon placement, and refunding
     upon cancellation or rejection, and an order management module (160) receiving
     staff input for changing order status including acceptance, rejection, or marking as
     ready.
     (FIG. 1)
15
     Dated This 19th day of February 2026


                                                                        (Kuldeep Singh)
                                                    Authorized Agent for the Applicant,
20                                          Indian Patent Agent Regn No. IN/PA-4358




                                             28
